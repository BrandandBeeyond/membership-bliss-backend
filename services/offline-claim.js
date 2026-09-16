const crypto = require("crypto");
const { JWT_SECRET } = require("../utils/config");

const normalizeCode = (value) => typeof value === "string" ? value.trim().replace(/[\s-]/g, "").toUpperCase() : "";
const hashCode = (code) => crypto.createHash("sha256").update(normalizeCode(code)).digest("hex");
const generateClaimCode = () => crypto.randomInt(100000, 1000000).toString();
const encryptionKey = crypto.createHash("sha256").update(JWT_SECRET || "").digest();
const encryptCode = code => { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv); const ciphertext = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]); return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${ciphertext.toString("base64")}`; };
const decryptCode = value => { try { const [iv, tag, ciphertext] = String(value || "").split(".").map(part => Buffer.from(part, "base64")); const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, iv); decipher.setAuthTag(tag); return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8"); } catch { return null; } };

function verifyClaimCode(code, hash) {
  const normalized = normalizeCode(code);
  if (!/^(?:\d{6}|[A-F0-9]{12})$/.test(normalized) || !/^[a-f0-9]{64}$/.test(hash || "")) return false;
  return crypto.timingSafeEqual(Buffer.from(hashCode(normalized), "hex"), Buffer.from(hash, "hex"));
}

function makeClaimMembership({ MembershipBooking, User }) {
  return async (req, res) => {
    try {
      const { membershipNumber, claimCode } = req.body || {};
      if (typeof membershipNumber !== "string" || !membershipNumber.trim() || !/^(?:\d{6}|[A-F0-9]{12})$/.test(normalizeCode(claimCode))) {
        return res.status(400).json({ success: false, message: "Membership number and 6-digit claim code are required" });
      }
      const userId = req.user?._id;
      const user = await User.findById(userId);
      if (!user?.phone) return res.status(400).json({ success: false, message: "Registered phone not found for current user" });
      const phone = String(user.phone).replace(/\D/g, "");
      let number = membershipNumber.trim().toUpperCase();
      if (!number.startsWith("TWB-")) number = `TWB-${number.replace(/^TWB-?/i, "")}`;
      const eligible = { membershipNumber: number, status: "Active", paymentStatus: "Completed", claimStatus: "Pending", endDate: { $gte: new Date() } };
      const booking = await MembershipBooking.findOne(eligible).select("+claimCodeHash");
      // Do not expose another member's record or whether their membership exists.
      if (!booking || !verifyClaimCode(claimCode, booking.claimCodeHash)) {
        return res.status(400).json({ success: false, message: "Invalid membership number or claim code, or membership is not available to claim" });
      }
      const bookingPhone = String(booking.memberDetails?.phone || "").replace(/\D/g, "");
      if (String(booking.userId) !== String(userId) && bookingPhone !== phone) {
        return res.status(403).json({ success: false, message: "This membership does not belong to your registered mobile number" });
      }
      const other = await MembershipBooking.findOne({ userId, _id: { $ne: booking._id }, status: "Active", paymentStatus: "Completed", endDate: { $gte: new Date() } });
      if (other) return res.status(409).json({ success: false, message: "User already has an active membership" });
      // A single atomic update consumes the code; concurrent claims or code resets cannot win twice.
      const claimed = await MembershipBooking.findOneAndUpdate(
        { ...eligible, _id: booking._id, claimCodeHash: booking.claimCodeHash },
        { $set: { userId, claimStatus: "Claimed", claimedAt: new Date(), memberDetails: { ...booking.memberDetails, fullname: booking.memberDetails?.fullname || user.fullname || "Member", email: booking.memberDetails?.email || user.email || "", phone } }, $unset: { claimCodeHash: 1, claimCodeCiphertext: 1 } },
        { new: true, runValidators: true },
      ).populate("membershipPlanId");
      if (!claimed) return res.status(409).json({ success: false, message: "Membership was already claimed or its code changed. Please refresh and try again." });
      return res.status(200).json({ success: true, message: "Membership claimed successfully", booking: claimed });
    } catch (error) {
      console.error("Membership claim failed:", error.name);
      return res.status(500).json({ success: false, message: "Failed to claim membership" });
    }
  };
}

function makeGenerateOfflineClaimCode({ MembershipBooking }) {
  return async (req, res) => {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id || "")) return res.status(400).json({ success: false, message: "Invalid booking ID" });
    try {
      const claimCode = generateClaimCode();
      const booking = await MembershipBooking.findOneAndUpdate(
        { _id: req.params.id, paymentMethod: "cash", claimStatus: "Pending", status: "Active", endDate: { $gte: new Date() } },
        { $set: { claimCodeHash: hashCode(claimCode), claimCodeCiphertext: encryptCode(claimCode), claimCodeCreatedAt: new Date() } },
        { new: true, runValidators: true },
      );
      if (!booking) return res.status(404).json({ success: false, message: "No unclaimed active offline booking found" });
      return res.status(200).json({ success: true, membershipNumber: booking.membershipNumber, claimCode, message: "New claim code generated. Any previous code is now invalid." });
    } catch {
      return res.status(500).json({ success: false, message: "Unable to generate claim code" });
    }
  };
}

function makeRevealOfflineClaimCode({ MembershipBooking }) { return async (req, res) => { if (!/^[a-f0-9]{24}$/i.test(req.params.id || "")) return res.status(400).json({ success: false, message: "Invalid booking ID" }); const booking = await MembershipBooking.findOne({ _id: req.params.id, paymentMethod: "cash", claimStatus: "Pending", status: "Active", endDate: { $gte: new Date() } }).select("+claimCodeCiphertext"); if (!booking) return res.status(404).json({ success: false, message: "Offline booking not found or not claimable" }); const claimCode = decryptCode(booking.claimCodeCiphertext); if (!claimCode) return res.status(409).json({ success: false, message: "This older code cannot be shown. Generate a replacement code." }); return res.json({ success: true, membershipNumber: booking.membershipNumber, claimCode }); }; }
module.exports = { normalizeCode, hashCode, encryptCode, generateClaimCode, verifyClaimCode, makeClaimMembership, makeGenerateOfflineClaimCode, makeRevealOfflineClaimCode };

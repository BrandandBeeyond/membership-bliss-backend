const { generateClaimCode, hashCode, encryptCode, normalizeMembershipNumber } = require("./offline-claim");

const MAX_ROWS = 500;
const text = (value) => (value === undefined || value === null ? "" : String(value).trim());

const normalizePhone = (value) => {
  let digits = text(value).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^\d{10}$/.test(digits) ? digits : null;
};

// Accepts DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY (sheet format) or ISO YYYY-MM-DD.
const parsePurchaseDate = (value) => {
  const raw = text(value);
  let day, month, year;
  let match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) [, day, month, year] = match;
  else if ((match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) [, year, month, day] = match;
  else return null;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCDate() !== Number(day) || date.getUTCMonth() !== Number(month) - 1) return null;
  return date;
};

const parseAmount = (value) => {
  const raw = text(value).replace(/[,\s₹]|rs\.?/gi, "");
  if (raw === "") return 0;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

function makeImportOfflineBookings({ MembershipBooking, User, MembershipPlan, buildQr, now = () => new Date() }) {
  return async (req, res) => {
    const { rows, membershipPlanId } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ success: false, message: "rows must be a non-empty array" });
    if (rows.length > MAX_ROWS) return res.status(400).json({ success: false, message: `At most ${MAX_ROWS} rows can be imported at once` });
    if (!/^[a-f0-9]{24}$/i.test(membershipPlanId || "")) return res.status(400).json({ success: false, message: "A valid membershipPlanId is required" });

    let plan;
    try { plan = await MembershipPlan.findById(membershipPlanId); }
    catch { return res.status(500).json({ success: false, message: "Unable to load membership plan" }); }
    if (!plan) return res.status(404).json({ success: false, message: "Membership plan not found" });
    const validityDays = Number(plan.validityinDays) || 365;

    const results = [];
    const seenNumbers = new Set();
    const seenPhones = new Set();

    for (const [index, input] of rows.entries()) {
      const row = index + 1;
      const fullname = text(input?.fullname);
      const phone = normalizePhone(input?.phone);
      const membershipNumber = normalizeMembershipNumber(input?.membershipNumber);
      const startDate = parsePurchaseDate(input?.purchaseDate);
      const amount = parseAmount(input?.amount);
      const fail = (message) => results.push({ row, fullname, membershipNumber, status: "failed", message });

      if (!fullname) { fail("Name is required"); continue; }
      if (!phone) { fail("Valid 10-digit phone is required"); continue; }
      if (!text(input?.membershipNumber)) { fail("Membership number is required"); continue; }
      if (!startDate) { fail("Purchase date must be DD-MM-YYYY"); continue; }
      if (amount === null) { fail("Amount must be a non-negative number"); continue; }
      if (seenNumbers.has(membershipNumber)) { fail("Duplicate membership number in file"); continue; }
      if (seenPhones.has(phone)) { fail("Duplicate phone number in file"); continue; }
      seenNumbers.add(membershipNumber);
      seenPhones.add(phone);

      try {
        if (await MembershipBooking.findOne({ membershipNumber })) {
          results.push({ row, fullname, membershipNumber, status: "skipped", message: "Membership number already exists" });
          continue;
        }

        const endDate = new Date(startDate);
        endDate.setUTCDate(endDate.getUTCDate() + validityDays);
        const expired = endDate < now();

        let user = await User.findOne({ phone });
        if (user && !expired) {
          const active = await MembershipBooking.findOne({ userId: user._id, status: "Active", paymentStatus: "Completed", endDate: { $gte: now() } });
          if (active) { fail(`Phone already has active membership ${active.membershipNumber}`); continue; }
        }
        if (!user) {
          user = await User.create({ fullname, phone, loginType: "otp", city: "Offline", state: "Offline", profileCompleted: true });
        }

        const remarks = text(input?.remarks);
        const claimCode = generateClaimCode();
        const qr = await buildQr();
        await MembershipBooking.create({
          userId: user._id,
          membershipPlanId: plan._id,
          membershipNumber,
          claimCodeHash: hashCode(claimCode),
          claimCodeCiphertext: encryptCode(claimCode),
          claimCodeCreatedAt: now(),
          memberDetails: { fullname, email: text(input?.email).toLowerCase(), phone, city: text(input?.branch) },
          paymentReceived: amount,
          paymentPending: 0,
          sellingCost: amount,
          startDate,
          endDate,
          paymentDate: startDate,
          paymentMethod: "cash",
          paymentMode: text(input?.paymentMode),
          paymentStatus: "Completed",
          claimStatus: "Pending",
          status: expired ? "Expired" : "Active",
          leadSource: text(input?.leadSource),
          salesPerson: text(input?.salesPerson),
          branch: text(input?.branch),
          remarks,
          isComplimentary: amount === 0 || /complimentary/i.test(remarks),
          importedAt: now(),
          qrTrackingToken: qr.token,
          qrcodeURL: qr.dataUrl,
        });
        results.push({ row, fullname, membershipNumber, status: "created" });
      } catch (error) {
        console.error("Offline import row failed:", row, error?.name, error?.code);
        fail(error?.code === 11000 ? "Duplicate membership number or phone in database" : "Could not save this row");
      }
    }

    const count = (status) => results.filter((result) => result.status === status).length;
    return res.status(200).json({ success: true, summary: { total: rows.length, created: count("created"), skipped: count("skipped"), failed: count("failed") }, results });
  };
}

module.exports = { makeImportOfflineBookings, normalizePhone, parsePurchaseDate, parseAmount };

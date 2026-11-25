// Admin-side voucher redemption: list requests, redeem with the member's code, or reject.
// Flow: the member requests a quantity in the app and is shown a 6-digit code; at the
// counter they read the code out, and the admin enters it here to redeem.

const isObjectId = (value) => /^[a-f0-9]{24}$/i.test(String(value || ""));
const text = (value, max = 300) => (typeof value === "string" ? value.trim().slice(0, max) : "");

const usedQuantity = (booking, itemId) =>
  (booking?.usedOffers || [])
    .filter((used) => String(used.itemId) === String(itemId))
    .reduce((sum, used) => sum + Number(used.quantityUsed || 0), 0);

const findItem = (offer, itemId) => (offer?.items || []).find((item) => String(item._id) === String(itemId)) || null;

function makeListRedemptions({ VoucherRedeemtion, OfferCategory }) {
  return async (_req, res) => {
    try {
      const redemptions = await VoucherRedeemtion.find()
        .select("-otpCode")
        .sort({ requestedAt: -1 })
        .populate({
          path: "membershipBookingId",
          select: "membershipNumber membershipPlanId memberDetails usedOffers status endDate",
          populate: { path: "membershipPlanId", select: "name" },
        })
        .lean();

      const categoryIds = [...new Set(redemptions.map((r) => String(r.categoryId)).filter(isObjectId))];
      const offers = await OfferCategory.find({ _id: { $in: categoryIds } }).select("title type items").lean();
      const offersById = new Map(offers.map((offer) => [String(offer._id), offer]));

      const reedemedVouchers = redemptions.map((redemption) => {
        const offer = offersById.get(String(redemption.categoryId));
        const item = findItem(offer, redemption.itemId);
        const booking = redemption.membershipBookingId;
        const allowance = item ? Number(item.inventory || 0) : null;
        const used = usedQuantity(booking, redemption.itemId);
        const { usedOffers, ...bookingSummary } = booking || {};
        return {
          ...redemption,
          membershipBookingId: booking ? bookingSummary : null,
          offerTitle: offer?.title || null,
          offerType: offer?.type || null,
          itemName: item?.name || null,
          itemWorth: item?.worth ?? null,
          allowance,
          usedQuantity: used,
          remainingQuantity: allowance === null ? null : Math.max(allowance - used, 0),
        };
      });

      return res.status(200).json({ success: true, reedemedVouchers });
    } catch (error) {
      console.error("Voucher list failed:", error?.message);
      return res.status(500).json({ success: false, message: "Unable to load voucher requests" });
    }
  };
}

function makeApproveRedemption({ VoucherRedeemtion, MembershipBooking, OfferCategory, notify, now = () => new Date() }) {
  return async (req, res) => {
    try {
      const { redemptionId } = req.body || {};
      const code = String(req.body?.otpCode ?? "").replace(/\D/g, "");
      const quantity = Number(req.body?.quantityApproved);

      if (!isObjectId(redemptionId)) return res.status(400).json({ success: false, message: "Invalid redemption ID" });
      if (!/^\d{6}$/.test(code)) return res.status(400).json({ success: false, message: "Enter the 6-digit code from the member's app" });
      if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ success: false, message: "Quantity must be at least 1" });

      const redemption = await VoucherRedeemtion.findById(redemptionId);
      if (!redemption) return res.status(404).json({ success: false, message: "Redemption request not found" });
      if (redemption.status !== "Pending") return res.status(409).json({ success: false, message: `This request is already ${redemption.status.toLowerCase()}` });
      if (String(redemption.otpCode) !== code) return res.status(400).json({ success: false, message: "Incorrect code. Ask the member to check the code in their app." });
      if (quantity > Number(redemption.quantityRequested || 0)) {
        return res.status(400).json({ success: false, message: `Member requested only ${redemption.quantityRequested}` });
      }

      const booking = await MembershipBooking.findById(redemption.membershipBookingId);
      if (!booking || !booking.userId) return res.status(404).json({ success: false, message: "Membership not found" });
      if (booking.status !== "Active" || (booking.endDate && new Date(booking.endDate) < now())) {
        return res.status(400).json({ success: false, message: "Membership is not active" });
      }

      const offer = await OfferCategory.findById(redemption.categoryId);
      const item = findItem(offer, redemption.itemId);
      if (!item) return res.status(404).json({ success: false, message: "Voucher no longer exists" });
      const remaining = Math.max(Number(item.inventory || 0) - usedQuantity(booking, redemption.itemId), 0);
      if (quantity > remaining) {
        return res.status(400).json({ success: false, message: remaining ? `Only ${remaining} left for this member` : "Member has no quantity left for this voucher" });
      }

      // Status + code in the filter makes approval single-use even if two admins submit together.
      const approved = await VoucherRedeemtion.findOneAndUpdate(
        { _id: redemption._id, status: "Pending", otpCode: redemption.otpCode },
        { $set: { status: "Approved", quantityApproved: quantity, approvedAt: now(), approvedBy: req.admin?._id || null } },
        { returnDocument: "after" },
      );
      if (!approved) return res.status(409).json({ success: false, message: "This request was just processed. Refresh and try again." });

      await MembershipBooking.updateOne(
        { _id: booking._id },
        { $push: { usedOffers: { categoryId: redemption.categoryId, itemId: redemption.itemId, redemptionId: redemption._id, quantityUsed: quantity, usedOn: now() } } },
      );

      await notify({
        userId: booking.userId,
        title: "Voucher Redeemed",
        message: `${quantity} × ${item.name}${offer?.title ? ` (${offer.title})` : ""} redeemed successfully.`,
        type: "general",
      });

      const result = approved.toObject ? approved.toObject() : { ...approved };
      delete result.otpCode;
      return res.json({ success: true, message: "Voucher redeemed", data: result });
    } catch (error) {
      console.error("Voucher redeem failed:", error?.message);
      return res.status(500).json({ success: false, message: "Unable to redeem voucher" });
    }
  };
}

function makeRejectRedemption({ VoucherRedeemtion, MembershipBooking, notify, now = () => new Date() }) {
  return async (req, res) => {
    try {
      const { id } = req.params;
      if (!isObjectId(id)) return res.status(400).json({ success: false, message: "Invalid redemption ID" });
      const reason = text(req.body?.reason);

      const rejected = await VoucherRedeemtion.findOneAndUpdate(
        { _id: id, status: "Pending" },
        { $set: { status: "Rejected", rejectedAt: now(), rejectedBy: req.admin?._id || null, rejectionReason: reason } },
        { returnDocument: "after" },
      );
      if (!rejected) {
        const exists = await VoucherRedeemtion.exists({ _id: id });
        return res.status(exists ? 409 : 404).json({ success: false, message: exists ? "This request is already processed" : "Redemption request not found" });
      }

      const booking = await MembershipBooking.findById(rejected.membershipBookingId).select("userId");
      if (booking?.userId) {
        await notify({
          userId: booking.userId,
          title: "Voucher request declined",
          message: reason ? `Your voucher request was declined: ${reason}` : "Your voucher request was declined. Please contact the front desk.",
          type: "general",
        });
      }

      const result = rejected.toObject ? rejected.toObject() : { ...rejected };
      delete result.otpCode;
      return res.json({ success: true, message: "Voucher request rejected", data: result });
    } catch (error) {
      console.error("Voucher reject failed:", error?.message);
      return res.status(500).json({ success: false, message: "Unable to reject voucher request" });
    }
  };
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Per-guest voucher balance for the admin "Redeemed" tab: search by guest name and get,
// for each voucher in the member's plan, how many are used and how many are still pending.
function makeMemberVoucherBalance({ MembershipBooking, OfferCategory, VoucherRedeemtion }) {
  return async (req, res) => {
    try {
      const name = text(req.query?.name, 80);
      if (name.length < 2) return res.status(400).json({ success: false, message: "Type at least 2 letters of the guest name" });

      const bookings = await MembershipBooking.find({
        "memberDetails.fullname": { $regex: escapeRegex(name), $options: "i" },
        status: { $ne: "Cancelled" },
      })
        .select("membershipNumber membershipPlanId memberDetails.fullname memberDetails.phone usedOffers status startDate endDate")
        .populate({ path: "membershipPlanId", select: "name offers" })
        .sort({ "memberDetails.fullname": 1 })
        .limit(20)
        .lean();

      const offerIds = new Set();
      bookings.forEach((b) => {
        (b.membershipPlanId?.offers || []).forEach((id) => offerIds.add(String(id)));
        (b.usedOffers || []).forEach((u) => offerIds.add(String(u.categoryId)));
      });
      const offers = await OfferCategory.find({ _id: { $in: [...offerIds].filter(isObjectId) } }).select("title type items").lean();
      const offersById = new Map(offers.map((offer) => [String(offer._id), offer]));

      const waiting = await VoucherRedeemtion.find({ membershipBookingId: { $in: bookings.map((b) => b._id) }, status: "Pending" })
        .select("membershipBookingId itemId quantityRequested")
        .lean();

      const members = bookings.map((booking) => {
        const planOfferIds = (booking.membershipPlanId?.offers || []).map(String);
        const usedOfferIds = (booking.usedOffers || []).map((u) => String(u.categoryId));
        const vouchers = [];
        [...new Set([...planOfferIds, ...usedOfferIds])].forEach((offerId) => {
          const offer = offersById.get(offerId);
          if (!offer) return;
          const inPlan = planOfferIds.includes(offerId);
          (offer.items || []).forEach((item) => {
            const uses = (booking.usedOffers || []).filter((u) => String(u.itemId) === String(item._id));
            if (!inPlan && !uses.length) return;
            const used = uses.reduce((sum, u) => sum + Number(u.quantityUsed || 0), 0);
            const allowance = Number(item.inventory || 0);
            vouchers.push({
              categoryId: offer._id,
              itemId: item._id,
              offerTitle: offer.title,
              offerType: offer.type,
              itemName: item.name,
              itemWorth: item.worth ?? null,
              allowance,
              usedQuantity: used,
              remainingQuantity: Math.max(allowance - used, 0),
              waitingQuantity: waiting
                .filter((w) => String(w.membershipBookingId) === String(booking._id) && String(w.itemId) === String(item._id))
                .reduce((sum, w) => sum + Number(w.quantityRequested || 0), 0),
              lastUsedOn: uses.reduce((latest, u) => (!latest || new Date(u.usedOn) > new Date(latest) ? u.usedOn : latest), null),
            });
          });
        });
        return {
          _id: booking._id,
          membershipNumber: booking.membershipNumber,
          fullname: booking.memberDetails?.fullname || "",
          phone: booking.memberDetails?.phone || "",
          planName: booking.membershipPlanId?.name || null,
          status: booking.status,
          endDate: booking.endDate,
          vouchers,
        };
      });

      return res.status(200).json({ success: true, members });
    } catch (error) {
      console.error("Member voucher balance failed:", error?.message);
      return res.status(500).json({ success: false, message: "Unable to load member vouchers" });
    }
  };
}

module.exports = { makeListRedemptions, makeApproveRedemption, makeRejectRedemption, makeMemberVoucherBalance, usedQuantity };

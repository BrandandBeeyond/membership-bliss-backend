const createNotification = require("../config/createNotification");
const MembershipBooking = require("../models/MembershipBooking.model");
const OfferCategory = require("../models/Offercategory.model");
const VoucherRedeemtion = require("../models/VoucherRedeemtion.model");
const { makeListRedemptions, makeApproveRedemption, makeRejectRedemption, makeMemberVoucherBalance } = require("../services/voucher-review");

const generateOTP = () => Math.floor(100000 + Math.random() * 900000);

const createVoucherRedeemtion = async (req, res) => {
  try {
    const { membershipBookingId, categoryId, itemId, quantityRequested } =
      req.body;

    if (!membershipBookingId || !categoryId || !itemId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing Required Fields" });
    }

    const booking = await MembershipBooking.findById(membershipBookingId);

    if (!booking || booking.status !== "Active") {
      return res
        .status(400)
        .json({ success: false, message: "Membership not active" });
    }

    const otpCode = generateOTP();

    const redemption = await VoucherRedeemtion.create({
      membershipBookingId,
      categoryId,
      itemId,
      quantityRequested,
      verificationMethod: "OTP",
      otpCode,
      status: "Pending",
    });

    return res.json({
      success: true,
      message: "Redemption created",
      data: {
        redemptionId: redemption._id,
        otpCode,
        quantityRequested,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const resendVerifyVoucherCode = async (req, res) => {
  try {
    const { redemptionId } = req.body;

    if (!redemptionId) {
      return res
        .status(400)
        .json({ success: false, message: "redemeption id is required" });
    }

    const redemption = await VoucherRedeemtion.findById(redemptionId);

    if (!redemption) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    if (redemption.status !== "Pending") {
      return res
        .status(400)
        .json({ success: false, message: "Redemption already processed" });
    }

    const newOtp = generateOTP();

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    redemption.otpCode = newOtp;
    redemption.expiresAt = expiresAt;
    redemption.requestedAt = new Date();

    await redemption.save();

    return res.json({
      success: true,
      message: "OTP resent successfully",
      data: {
        redemptionId: redemption._id,
        otpCode: newOtp,
        expiresAt,
        status: "Pending",
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Resend otp code error" });
  }
};

const checkVoucherPendingRedemption = async (req, res) => {
  try {
    const { membershipBookingId, categoryId, itemId } = req.query;

    if (!membershipBookingId || !categoryId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing Required Fields" });
    }

    const pending = await VoucherRedeemtion.findOne({
      membershipBookingId,
      categoryId,
      itemId,
      status: "Pending",
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!pending) {
      // Let the app's polling see a decision made at the counter in the last few minutes.
      const since = new Date(Date.now() - 5 * 60 * 1000);
      const decided = await VoucherRedeemtion.findOne({
        membershipBookingId,
        categoryId,
        itemId,
        $or: [
          { status: "Approved", approvedAt: { $gte: since } },
          { status: "Rejected", rejectedAt: { $gte: since } },
        ],
      })
        .sort({ requestedAt: -1 })
        .select("status quantityApproved rejectionReason")
        .lean();

      return res.json({
        success: true,
        message: decided ? `Redemption ${decided.status.toLowerCase()}` : "No pending redemption",
        data: decided
          ? {
              redemptionId: decided._id,
              status: decided.status,
              quantityApproved: decided.quantityApproved,
              rejectionReason: decided.rejectionReason || "",
            }
          : null,
      });
    }

    return res.json({
      success: true,
      message: "Pending redemption found",
      data: {
        redemptionId: pending._id,
        otpCode: pending.otpCode,
        quantityRequested: pending.quantityRequested,
        status: pending.status,
        expiresAt: new Date(
          new Date(pending.requestedAt).getTime() + 10 * 60 * 1000,
        ),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Admin list/redeem/reject live in services/voucher-review.js (unit-tested).
const getAllRedeemVoucherRequests = makeListRedemptions({ VoucherRedeemtion, OfferCategory });
const approveVoucherRedeemptionWithCode = makeApproveRedemption({ VoucherRedeemtion, MembershipBooking, OfferCategory, notify: createNotification });
const rejectVoucherRedemption = makeRejectRedemption({ VoucherRedeemtion, MembershipBooking, notify: createNotification });
const getMemberVoucherBalance = makeMemberVoucherBalance({ MembershipBooking, OfferCategory, VoucherRedeemtion });

module.exports = {
  createVoucherRedeemtion,
  resendVerifyVoucherCode,
  checkVoucherPendingRedemption,
  getAllRedeemVoucherRequests,
  approveVoucherRedeemptionWithCode,
  rejectVoucherRedemption,
  getMemberVoucherBalance,
};

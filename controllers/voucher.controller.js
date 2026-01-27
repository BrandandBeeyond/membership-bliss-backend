const createNotification = require("../config/createNotification");
const MembershipBooking = require("../models/MembershipBooking.model");
const OfferCategory = require("../models/Offercategory.model");
const VoucherRedeemtion = require("../models/VoucherRedeemtion.model");

const generateOTP = () => Math.floor(100000 + Math.random() * 900000);

const createVoucherRedeemtion = async (req, res) => {
  try {
    const { membershipBookingId, offerId, quantityRequested } = req.body;

    if (!membershipBookingId || !offerId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing Rquired Fields" });
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
      offerId,
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
    const { membershipBookingId, offerId } = req.query;

    if (!membershipBookingId || !offerId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing Required Fields" });
    }

    const pending = await VoucherRedeemtion.findOne({
      membershipBookingId,
      offerId,
      status: "Pending",
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!pending) {
      return res.json({
        success: true,
        message: "No pending redemption",
        data: null,
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

const getAllRedeemVoucherRequests = async (req, res) => {
  try {
    let allredeemVouchers = await VoucherRedeemtion.find().populate({
      path: "membershipBookingId",
      select: "userId membershipNumber membershipPlanId memberDetails",
      populate: [
        {
          path: "userId",
          select: "name email",
        },
        {
          path: "membershipPlanId",
          select: "name",
        },
      ],
    });

    const updatedVouchers = await Promise.all(
      allredeemVouchers.map(async (voucher) => {
        const offer = await OfferCategory.findOne({
          "items._id": voucher.offerId,
        });

        let itemName = null;
        let offerTitle = null;

        if (offer) {
          offerTitle = offer.title;
          const item = offer.items.find(
            (it) => it._id.toString() === voucher.offerId.toString(),
          );
          itemName = item?.name || null;
        }

        return {
          ...voucher.toObject(),
          offerTitle,
          itemName,
        };
      }),
    );

    return res.status(200).json({
      success: true,
      reedemedVouchers: updatedVouchers,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const approveVoucherRedeemptionWithCode = async (req, res) => {
  try {
    console.log("sending body", req.body);

    const { redemptionId, adminId, otpCode, quantityApproved } = req.body;

    if (!redemptionId || !adminId || !otpCode || !quantityApproved) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const redemption = await VoucherRedeemtion.findById(redemptionId);

    if (!redemption) {
      return res.status(404).json({
        success: false,
        message: "Redemption not found",
      });
    }

    if (redemption.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Redemption already processed",
      });
    }

    if (redemption.otpCode !== otpCode) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    const booking = await MembershipBooking.findById(
      redemption.membershipBookingId,
    );

    if (!booking || !booking.userId) {
      return res.status(404).json({ message: "Membership Booking not found" });
    }

    redemption.status = "Approved";
    redemption.quantityApproved = quantityApproved;
    redemption.approvedAt = new Date();
    redemption.approvedBy = adminId;

    await redemption.save();

    await createNotification({
      userId: booking.userId,
      title: "Voucher Redeemed",
      message: `Your voucher request has been approved for ${quantityApproved} item(s).`,
      type: "general",
    });

    await MembershipBooking.findOneAndUpdate(
      { _id: redemption.membershipBookingId },
      {
        $push: {
          usedOffers: {
            categoryId: redemption.categoryId,
            itemId: redemption.itemId,
            quantityUsed: quantityApproved,
            usedAt: new Date(),
          },
        },
      },
    );

    await OfferCategory.findOneAndUpdate(
      {
        _id: redemption.categoryId,
        "items._id": redemption.itemId,
      },
      {
        $inc: {
          "items.$.usedCount": quantityApproved,
        },
      },
    );

    return res.json({
      success: true,
      message: "Redemption verified successfully",
      data: redemption,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Redemption verify error" });
  }
};

module.exports = {
  createVoucherRedeemtion,
  resendVerifyVoucherCode,
  checkVoucherPendingRedemption,
  getAllRedeemVoucherRequests,
  approveVoucherRedeemptionWithCode,
};

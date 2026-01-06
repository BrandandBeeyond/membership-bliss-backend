const MembershipBooking = require("../models/MembershipBooking.model");
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

const verifyOtpRedeemption = async (req, res) => {
  try {
    const { redemptionId, otpCode, adminId } = req.body;

    const redemption = await VoucherRedeemtion.findById(redemptionId);

    if (!redemption) {
      return res.status(404).json({ message: "Redemption not found" });
    }

    if (redemption.status !== "Pending") {
      return res.status(400).json({ message: "Redemption already processed" });
    }

    if (redemption.otpCode !== otpCode) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    redemption.status = "Approved";
    redemption.quantityApproved = redemption.quantityRequested;
    redemption.approvedAt = new Date();
    redemption.approvedBy = adminId;

    await redemption.save();

    await MembershipBooking.findOneAndUpdate(redemption.membershipBookingId, {
      $push: {
        usedOffers: {
          offerId: redemption.offerId,
        },
      },
    });

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

module.exports = { createVoucherRedeemtion, verifyOtpRedeemption };

const MembershipBooking = require("../models/MembershipBooking.model");
const crypto = require("crypto");

const VerifyPaymentandCreateBooking = async (req, res) => {
  try {
    const {
      membershipPlanId,
      razorpay_orderId,
      razorpay_paymentId,
      razorpay_signature,
      memberDetails,
    } = req.body;

    const userId = req.user._id;

    if (
      !membershipPlanId ||
      !razorpay_orderId ||
      !razorpay_paymentId ||
      !razorpay_signature ||
      !memberDetails
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing payment or membership details",
      });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_orderId + "|" + razorpay_paymentId)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: "Payment verification failed" });
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    const newbooking = await MembershipBooking.create({
      userId,
      membershipPlanId,
      memberDetails,
      startDate,
      endDate,
      razorpay_orderId,
      razorpay_paymentId,
      razorpay_signature,
      paymentStatus: "Completed",
      status: "Active",
    });

    return res.status(200).json({
      success: true,
      message: "Membership booking created successfully",
      booking: newbooking,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server error", error: error.message });
    console.error("Membership booking creation failed", error);
  }
};

module.exports = { VerifyPaymentandCreateBooking };

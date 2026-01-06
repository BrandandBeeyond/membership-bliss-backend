const mongoose = require("mongoose");

const voucherRedeemtionSchema = new mongoose.Schema({
  membershipBookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MembershipBooking",
    required: true,
  },
  offerId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  quantityRequested: {
    type: Number,
    default: 1,
  },

  quantityApproved: {
    type: Number,
    default: 0,
  },
  verificationMethod: {
    type: String,
    enum: ["OTP", "QR", "CODE"],
    default: "OTP",
  },
  otpCode: String,
  qrCode: String,
  redemptionCode: String,
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected", "Expired"],
    default: "Pending",
  },

  requestedAt: { type: Date, default: Date.now },
  approvedAt: Date,
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
});

const VoucherRedeemtion = mongoose.model(
  "VoucherRedeemtion",
  voucherRedeemtionSchema
);

module.exports = VoucherRedeemtion;

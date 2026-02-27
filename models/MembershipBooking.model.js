const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const usedOffersSchema = new mongoose.Schema({
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "OfferCategory",
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  redemptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "VoucherRedeemtion",
    required: false,
    default: null,
  },
  quantityUsed: {
    type: Number,
    required: true,
    min: 1,
  },
  usedOn: {
    type: Date,
    default: Date.now,
  },
});

const membershipBookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  membershipPlanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MembershipPlan",
    required: true,
  },
  membershipNumber: {
    type: String,
    unique: true,
    default: () => "TWB-" + uuidv4().slice(0, 8).toUpperCase(),
  },
  memberDetails: {
    fullname: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    dob: { type: Date },
    gender: { type: String },
    state: { type: String },
    city: { type: String },
    address: { type: String },
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ["online", "cash"],
    default: "online",
  },
  razorpay_orderId: {
    type: String,
    required: function () {
      return this.paymentMethod === "online";
    },
  },
  razorpay_paymentId: {
    type: String,
    required: function () {
      return this.paymentMethod === "online";
    },
  },
  razorpay_signature: {
    type: String,
    required: function () {
      return this.paymentMethod === "online";
    },
  },
  paymentDate: {
    type: Date,
    default: Date.now,
  },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Completed", "Failed"],
    default: "Pending",
  },

  status: {
    type: String,
    enum: ["Active", "Expired", "Cancelled"],
    default: "Active",
  },
  usedOffers: {
    type: [usedOffersSchema],
    default: [],
  },

  arrivalDate: {
    type: Date,
    default: null,
  },
  arrivalStatus: {
    type: String,
    enum: ["Pending", "Approved", "Rejected", "NotRequested"],
    default: "NotRequested",
  },

  physicalCardRequested: {
    type: Boolean,
    default: false,
  },

  physicalCardIssued: {
    type: Boolean,
    default: false,
  },

  qrcodeURL: {
    type: String,
    default: "",
  },

  qrTrackingToken: {
    type: String,
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const MembershipBooking = mongoose.model(
  "MembershipBooking",
  membershipBookingSchema,
);

module.exports = MembershipBooking;

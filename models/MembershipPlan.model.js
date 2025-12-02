const mongoose = require("mongoose");

const policySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  detail: {
    type: String,
    default: "",
  },
  points: {
    type: [String],
    default: [],
  },
});

const membershipPlanSchema = new mongoose.Schema({
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MembershipCategory",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  validityinDays: {
    type: Number,
    required: true,
    default: 365,
  },
  benefits: {
    type: [String],
    default: [],
  },
  policyDetails: {
    type: [policySchema],
    default: [],
  },
  usageLimit: {
    type: Number,
    default: null,
  },
  discountDetails: {
    type: [String],
    default: null,
  },
  offers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
    },
  ],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const MembershipPlan = mongoose.model("MembershipPlan", membershipPlanSchema);

module.exports = MembershipPlan;

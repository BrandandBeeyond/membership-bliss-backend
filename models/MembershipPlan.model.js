const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema({
  offertitle: {
    type: String,
    required: true,
  },
  offerDescription: {
    type: String,
    default: "",
  },
  offerThumbnail: {
    public_id: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
  },
  offerIncludes: {
    type: [String],
    default: [],
  },
  inventory: {
    type: Number,
    default: null,
    required: false,
  },
  usedCount: {
    type: Number,
    default: 0,
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
    type: [String],
    default: "",
  },
  usageLimit: {
    type: Number,
    default: null,
  },
  discountDetails: {
    type: [String],
    default: null,
  },
  offers: {
    type: [offerSchema],
    default: [],
  },
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

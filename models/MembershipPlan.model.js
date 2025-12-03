const mongoose = require("mongoose");

const policySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
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
  carouselImages: [
    {
      public_id: {
        type: String,
        required: [true, "Please upload a thumbnail image"],
      },
      url: {
        type: String,
        required: [true, "Please upload a thumbnail image"],
      },
    },
  ],
  benefits: {
    type: [String],
    default: [],
  },
  policyDetails: {
    type: [policySchema],
    default: [],
  },
  discountDetails: {
    type: [String],
    default: null,
  },
  offers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OfferCategory",
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

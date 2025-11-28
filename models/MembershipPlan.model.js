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
        type: String,
        default: null,
        required: false,
    },
    offerIncludes: {
        type: [String],
        default: [],
    },
    inventory:{
        type: Number,
        default: null,
    },
    usedCount:{
        type: Number,
        default: 0,
    }
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
  },
  benefits: {
    type: [String],
    default: [],
  },
  usageLimit: {
    type: Number,
    default: null,
  },
  discountDetails: {
    type: String,
    default: "",
  },
  offers:{
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

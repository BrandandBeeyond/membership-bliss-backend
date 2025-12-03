const mongoose = require("mongoose");

const offerItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: false,
  },
  inventory: {
    type: Number,
    default: 0,
  },
  usedCount: {
    type: Number,
    default: 0,
  },
});

const offerCategorySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  thumbnail: {
    public_id: {
      type: String,
      required: [true, "Please upload a thumbnail image"],
    },
    url: {
      type: String,
      required: [true, "Please upload a thumbnail image"],
    },
  },
  items: {
    type: [offerItemSchema],
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

const OfferCategory = mongoose.model("OfferCategory", offerCategorySchema);

module.exports = OfferCategory;

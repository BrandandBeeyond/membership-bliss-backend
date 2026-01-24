const mongoose = require("mongoose");

const offerItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: false,
    default: "",
  },
  worth: {
    type: Number,
    required: true,
  },
  inventory: {
    type: Number,
    default: 0,
  },
});

const offerCategorySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["value", "discount"],
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
});

const OfferCategory = mongoose.model("OfferCategory", offerCategorySchema);

module.exports = OfferCategory;

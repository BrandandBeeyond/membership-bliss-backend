const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema({
  offertitle: {
    type: String,
    required: true,
  },
  offerDescription: {
    type: String,
    default: null,
  },
  offerThumbnail: {
    public_id: {
      type: String,
      required: [true, "Please upload a thumbnail image"],
    },
    url: {
      type: String,
      required: [true, "Please upload a thumbnail image"],
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

const Offer = mongoose.model("Offer", offerSchema);

module.exports = Offer;

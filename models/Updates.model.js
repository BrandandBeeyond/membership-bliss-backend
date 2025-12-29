const mongoose = require("mongoose");

const updatesSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      enum: ["whats_new", "events_retreats"],
      required: true,
    },

    thumbnail: {
      public_id: {
        type: String,
        required: [false, "Please upload a thumbnail image"],
      },
      url: {
        type: String,
        required: [false, "Please upload a thumbnail image"],
      },
    },
    updatedOn: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Updates = mongoose.model("Updates", updatesSchema);

module.exports = Updates;

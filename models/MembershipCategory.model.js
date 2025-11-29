const mongoose = require("mongoose");

const membershipCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    default: "",
  },
  thumbnail: {
    public_id: {
      type: String,
      required: [false, "PlPlease upload a thumbnail image"],
    },
    url: {
      type: String,
      required: [false, "Please upload a thumbnail image"],
    },
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

const MembershipCategory = mongoose.model(
  "MembershipCategory",
  membershipCategorySchema
);

module.exports = MembershipCategory;

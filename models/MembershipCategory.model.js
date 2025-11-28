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
    type: String,
    default: null,
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

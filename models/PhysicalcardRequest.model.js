const mongoose = require("mongoose");

const physicalCardRequestSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MembershipBooking",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fullname: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Shipped", "Delivered"],
      default: "Pending",
    },
    remarks: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

physicalCardRequestSchema.index(
  { bookingId: 1, status: 1 },
  { partialFilterExpression: { status: "Pending" } },
);

module.exports = mongoose.model(
  "PhysicalCardRequest",
  physicalCardRequestSchema,
);

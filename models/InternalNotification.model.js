const mongoose = require("mongoose");

const InternalNotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ["booking", "payment", "system", "general"],
      default: "general",
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const InternalNotification = mongoose.model(
  "InternalNotification",
  InternalNotificationSchema,
);

module.exports = InternalNotification;

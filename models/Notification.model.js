const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    image: {
      public_id: {
        type: String,
        required: [false, "Please upload image"],
      },
      url: {
        type: String,
        required: [false, "Please upload image"],
      },
    },
    type: {
      type: String,
      enum: ["GLOBAL", "USER_SPECIFIC"],
      required: true,
    },
    userIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    scheduledAt: {
      type: Date,
    },
    sent: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true },
);

const Notification = mongoose.model("Notification", NotificationSchema);

module.exports = Notification;

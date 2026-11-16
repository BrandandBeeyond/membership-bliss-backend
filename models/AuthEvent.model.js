const mongoose = require("mongoose");

// One row per guest sign-in / OTP action, shown in the admin panel's Guests page.
// Rows of type "otp_sent" also drive the OTP rate limit (services/auth-activity.js).
const AUTH_EVENT_TYPES = [
  "otp_sent", // OTP SMS sent (counts toward the limit)
  "otp_send_failed", // SMS provider failed
  "otp_limited", // blocked by the 3-per-90-minutes limit
  "otp_invalid", // wrong code entered
  "otp_expired", // code entered after it expired
  "signup", // first successful login, account created
  "login", // successful login of an existing account
  "profile_completed",
  "logout",
];

const authEventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: AUTH_EVENT_TYPES, required: true },
    phone: { type: String, default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    method: { type: String, enum: ["otp", "google", null], default: null },
    detail: { type: String, default: "" },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

authEventSchema.index({ phone: 1, type: 1, createdAt: -1 });
authEventSchema.index({ userId: 1, createdAt: -1 });
authEventSchema.index({ type: 1, createdAt: -1 });
authEventSchema.index({ createdAt: -1 });

const AuthEvent = mongoose.model("AuthEvent", authEventSchema);

module.exports = AuthEvent;
module.exports.AUTH_EVENT_TYPES = AUTH_EVENT_TYPES;

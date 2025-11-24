const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fullname: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    unique: true,
  },
  phone: {
    type: String,
    unique: true,
    sparse: true,
  },
  dob: {
    type: Date,
  },
  gender: {
    type: String,
  },
  city: {
    type: String,
    trim: true,
    default: "",
  },
  loginType: {
    type: String,
    enum: ["otp", "google"],
    required: true,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  otp: {
    type: String,
  },
  otpExpiresAt: {
    type: Date,
  },
  profileImage: {
    type: String,
    default: null,
  },
});

const User = mongoose.model("User", userSchema);

module.exports = User;

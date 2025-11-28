const { OAuth2Client } = require("google-auth-library");
const {
  GOOGLE_CLIENT_ID,
  MSG91_TEMPLATE_ID,
  MSG91_AUTH_KEY,
  JWT_SECRET,
} = require("../utils/config");
const User = require("../models/User.model");
const { default: axios } = require("axios");
const jwt = require("jsonwebtoken");

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    console.log("Received idToken:", idToken);
    console.log("GOOGLE CLIENT ID:", GOOGLE_CLIENT_ID);

    const payload = ticket.getPayload();

    const googleId = payload.sub;
    const email = payload.email;
    const fullname = payload.name;
    const picture = payload.picture;

    let user = await User.findOne({ googleId });

    if (!user) {
      user = await User.create({
        fullname,
        email,
        googleId,
        loginType: "google",
        profileImage: picture,
      });
    }

    const token = user.getJWTtoken();

    return res.status(200).json({ success: true, user, token });
  } catch (error) {
    console.error("GOOGLE LOGIN ERROR:", error.message);
    console.error("STACK:", error.stack);
    return res.status(500).json({ message: error.message });
  }
};

const SendOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone required",
      });
    }

    await User.findOneAndUpdate(
      { phone },
      { $set: { phone, loginType: "otp" } },
      { upsert: true, new: true }
    );

    const url = "https://api.msg91.com/api/v5/otp";

    const payload = {
      mobile: `91${phone}`,
      template_id: MSG91_TEMPLATE_ID,
    };

    const headers = {
      authkey: MSG91_AUTH_KEY,
      "Content-Type": "application/json",
    };

    const response = await axios.post(url, payload, { headers });

    if (response.data.type === "success" || response.data.type === "otp") {
      return res.json({ success: true, message: "OTP sent" });
    } else {
      return res.status(500).json({ success: false, detail: response.data });
    }
  } catch (error) {
    console.error("sendOtp err:", err.response?.data || err.message);
    return res.status(500).json({ message: "OTP send failed" });
  }
};

const VerifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp)
      return res.status(400).json({ message: "Phone & OTP required" });

    const url = "https://api.msg91.com/api/v5/otp/verify";

    const payload = {
      mobile: `91${phone}`,
      otp: otp,
    };

    const headers = {
      authkey: MSG91_AUTH_KEY,
      "Content-Type": "application/json",
    };

    const response = await axios.post(url, payload, { headers });

    if (response.data.type === "success") {
      let user = await User.findOne({ phone });

      if (!user) {
        user = await User.create({
          phone,
          loginType: "otp",
        });
      }

      user.isVerified = true;
      await user.save();

      const token = jwt.sign({ user: user._id }, JWT_SECRET, {
        expiresIn: "30d",
      });

      return res.status(200).json({ success: true, user, token });
    } else {
      return res.status(400).json({ success: false, detail: response.data });
    }
  } catch (error) {
    console.error("verifyOtp err:", err.response?.data || err.message);
    return res.status(500).json({ message: "OTP verification failed" });
  }
};

module.exports = { googleLogin, SendOtp, VerifyOtp };

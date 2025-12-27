const { OAuth2Client } = require("google-auth-library");
const {
  GOOGLE_CLIENT_ID,
  JWT_SECRET,
  OTP_API_KEY,
  OTP_CAMPAIGN,
  OTP_ROUTE,
  OTP_SENDER,
  OTP_TEMPLATE,
  OTP_PE_ID,
} = require("../utils/config");
const User = require("../models/User.model");
const { default: axios } = require("axios");
const jwt = require("jsonwebtoken");
const Otp = require("../models/Otp.model");

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const generateOTP = () => Math.floor(100000 + Math.random() * 900000);

const googleLogin = async (req, res) => {
  try {
    console.log("REQ BODY:", req.body);
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

const sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    console.log("entering phone", phone);

    if (!phone)
      return res
        .status(400)
        .json({ success: false, message: "Phone required" });

    const otp = generateOTP();
    const otpExpiry = Date.now() + 5 * 60 * 1000;

    const msg = `Your OTP is ${otp} to log in to the Touchwood Membership App. Wishing you calm moments in`;

    const url = `https://kutility.org/app/smsapi/index.php?key=${OTP_API_KEY}&campaign=${OTP_CAMPAIGN}&routeid=${OTP_ROUTE}&type=text&contacts=${phone}&senderid=${OTP_SENDER}&msg=${encodeURIComponent(
      msg
    )}&template_id=${OTP_TEMPLATE}&pe_id=${OTP_PE_ID}`;

    const response = await axios.get(url);

    if (!response?.data) {
      return res.status(502).json({
        success: false,
        message: "SMS vendor did not return a valid response",
      });
    }

    await Otp.findOneAndUpdate(
      { phone },
      { otp, otpExpiry },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({
      success: true,
      message: "OTP sent successfully",
      vendorResponse: response.data,
    });
  } catch (error) {
    console.error("Send OTP Error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Failed to send OTP" });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone & OTP required",
      });
    }

    const otpRecord = await Otp.findOne({ phone });

    if (!otpRecord) {
      return res.status(404).json({
        success: false,
        message: "No OTP request found for this phone number",
      });
    }

    if (otpRecord.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (otpRecord.otpExpiry < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
    }

    await Otp.deleteOne({ phone });

    let user = await User.findOne({ phone });

    if (!user) {
      user = await User.create({
        phone,
        loginType: "otp",
        isVerified: true,
        profileCompleted: false,
      });
    } else {
      user.isVerified = true;
      if (user.profileCompleted === undefined) {
        user.profileCompleted = false;
      }

      await user.save(); // normal save, no validation bypass needed
    }

    const token = user.getJWTtoken();

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      user,
      token,
    });
  } catch (error) {
    console.error("Verify OTP Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
    });
  }
};

const logoutUser = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "user logged out success",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

module.exports = { googleLogin, sendOTP, verifyOTP, logoutUser };

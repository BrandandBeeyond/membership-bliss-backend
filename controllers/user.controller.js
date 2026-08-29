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
  ANDROID_APP_SIGNATURE,
  FAST2SMS_OTP_ID,
  FAST2SMS_API_KEY,
} = require("../utils/config");
const User = require("../models/User.model");
const { default: axios } = require("axios");
const jwt = require("jsonwebtoken");
const Otp = require("../models/Otp.model");
const Cloudinary = require("cloudinary");

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const generateOTP = () => Math.floor(100000 + Math.random() * 900000);
const OTP_EXPIRY_MINUTES = 10;

const normalizePhone = phone => String(phone || "").replace(/\D/g, "");

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

    const cleanPhone = normalizePhone(phone);

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit Indian mobile number",
      });
    }

    const otp = String(generateOTP());
    const otpExpiry = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000;

    await Otp.findOneAndUpdate(
      { phone: cleanPhone },
      {
        phone: cleanPhone,
        otp,
        otpExpiry,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const response = await axios.post(
      "https://www.fast2sms.com/dev/otp/send",
      {
        mobile: cleanPhone,
        otp_id: FAST2SMS_OTP_ID,
        otp,
        otp_expiry: OTP_EXPIRY_MINUTES,
      },
      {
        timeout: 15000,
        headers: {
          authorization: FAST2SMS_API_KEY,
          accept: "application/json",
          "Content-Type": "application/json",
        },
      },
    );

    console.log("Fast2SMS Response:", response.data);

    if (!response?.data?.return) {
      await Otp.deleteOne({ phone: cleanPhone });
      return res.status(502).json({
        success: false,
        message: response?.data?.message || "Failed to send OTP",
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      requestId: response.data.request_id,
    });
  

  } catch (error) {
    console.error("Send OTP Error:", error.message);
    const cleanPhone = normalizePhone(req.body?.phone);
    if (cleanPhone) {
      await Otp.deleteOne({ phone: cleanPhone }).catch(() => {});
    }
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

    const cleanPhone = normalizePhone(phone);

    const otpRecord = await Otp.findOne({ phone: cleanPhone });

    if (!otpRecord) {
      return res.status(404).json({
        success: false,
        message: "No OTP request found for this phone number",
      });
    }

    if (String(otpRecord.otp) !== String(otp)) {
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

    await Otp.deleteOne({ phone: cleanPhone });

    let user = await User.findOne({ phone: cleanPhone });

    if (!user) {
      user = await User.create({
        phone: cleanPhone,
        loginType: "otp",
        isVerified: true,
        fullname: null,
        city: null,
        profileCompleted: false,
      });
    } else {
      user.isVerified = true;

      const hasProfile =
        user.fullname?.trim() && user.email?.trim() && user.city?.trim();

      user.profileCompleted = Boolean(hasProfile);

      await user.save();
    }

    const token = user.getJWTtoken();

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      user: {
        _id: user._id,
        phone: user.phone,
        fullname: user.fullname,
        email: user.email,
        city: user.city,
        profileCompleted: user.profileCompleted,
      },
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

const completeUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const { firstname, lastname, email, gender, state, city } = req.body;

    if (!firstname || !lastname || !email || !city) {
      return res.status(400).json({
        success: false,
        message: "First name, last name, email & city are required",
      });
    }

    const fullname = `${firstname} ${lastname}`.trim();

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.fullname = fullname;
    user.email = email;
    user.gender = gender || "";
    user.state = state || "";
    user.city = city;
    user.profileCompleted = true;

    await user.save();
    return res.status(200).json({
      success: true,
      message: "Profile completed successfully",
      user: {
        _id: user._id,
        phone: user.phone,
        fullname: user.fullname,
        email: user.email,
        gender: user.gender,
        state: user.state,
        city: user.city,
        profileCompleted: user.profileCompleted,
      },
    });
  } catch (error) {
    console.error("Complete Profile Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to complete profile",
    });
  }
};

const saveFcmToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token)
      return res
        .status(400)
        .json({ success: false, message: "Token required" });

    const userId = req.user._id || req.userId;
    console.log("saveFcmToken user:", req.user, req.userId);

    await User.findByIdAndUpdate(userId, { fcmToken: token });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const uploadProfilePhoto = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized" });
    }

    if (!req.files?.profilePhoto?.[0]) {
      return res.status(400).json({
        success: false,
        message: "Please upload profile photo",
      });
    }

    const uploadResult = await Cloudinary.v2.uploader.upload(
      req.files.profilePhoto[0].path,
      {
        folder: "users/profile-photo",
      },
    );

    const user = await User.findByIdAndUpdate(
      userId,
      {
        profileImage: uploadResult.secure_url,
      },
      { returnDocument: "after" },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile photo uploaded successfully",
      user: {
        ...user.toObject(),
        profilePhoto: {
          public_id: uploadResult.public_id,
          url: uploadResult.secure_url,
        },
      },
    });
  } catch (error) {
    console.error("Upload Profile Photo Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload profile photo",
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

module.exports = {
  googleLogin,
  sendOTP,
  verifyOTP,
  completeUserProfile,
  logoutUser,
  saveFcmToken,
  uploadProfilePhoto,
};

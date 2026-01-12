const Admin = require("../models/Admin.model");
const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");

const { JWT_EXPIRES_IN, JWT_SECRET } = require("../utils/config");

const generateToken = (admin) => {
  return jwt.sign(
    {
      id: admin._id,
      role: admin.role,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
    }
  );
};
const CreateAdmin = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res
        .status(400)
        .json({ success: false, message: "all fields are required" });
    }

    if (!["ADMIN", "COUNTER_STAFF"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const exists = await Admin.findOne({ email });

    if (exists) {
      return res
        .status(409)
        .json({ success: false, message: "Admin already exists" });
    }
    const hashedPassword = await bcrypt.hash("password", 12);

    const admin = await Admin.create({
      name,
      email,
      password: hashedPassword,
      role,
    });

    return res.status(201).json({
      success: true,
      message: "Admin created successfully",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

const AdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    const admin = await Admin.findOne({ email }).select("+password");

    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await admin.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken(admin);

    res.status(200).json({
      success: true,
      message: "Admin logged in successfully",
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};

const AdminLogout = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    res.status(500).json({ message: "Logout failed" });
  }
};

module.exports = { CreateAdmin, AdminLogin, AdminLogout };

const MembershipCategory = require("../models/MembershipCategory.model");
const Cloudinary = require("cloudinary");

const createMembershipCategory = async (req, res) => {
  try {
    const { name, description, isActive } = req.body;

    if (!name || !description || !isActive) {
      return res
        .status(400)
        .json({ success: false, message: "Please enter required fields" });
    }

    if (!req.files || !req.files.thumbnail) {
      return res.status(400).json({ message: "Please upload thumbnail image" });
    }

    const existingCategory = await MembershipCategory.findOne({ name });

    if (existingCategory) {
      return res
        .status(400)
        .json({ success: false, message: "category already exists" });
    }

    const thumbnailResult = await Cloudinary.v2.uploader.upload(
      req.files.thumbnail[0].path,
      {
        folder: "categories/thumbnails",
      }
    );

    const category = await MembershipCategory.create({
      name: name.trim(),
      description,
      isActive,
      thumbnail: {
        public_id: thumbnailResult.public_id,
        url: thumbnailResult.secure_url,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Membership category created",
      newcategory: category,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server error", error: error.message });
    console.error("membership category creation failed", error);
  }
};

const getAllCategories = async (req, res) => {
  try {
    const allcategories = await MembershipCategory.find();

    if (!allcategories) {
      return res.status(400).json({
        success: false,
        message: "No categories found for memberships",
      });
    }

    return res.status(200).json({
      success: true,
      message: "categories data",
      categories: allcategories,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server error", error: error.message });
    console.error("Fetching membership categories failed", error);
  }
};

module.exports = { createMembershipCategory,getAllCategories };

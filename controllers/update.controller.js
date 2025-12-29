const Updates = require("../models/Updates.model");
const Cloudinary = require("cloudinary");

const createUpdates = async (req, res) => {
  try {
    const { title, description, category } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({
        success: false,
        message: "title,description and category is required",
      });
    }

    const existingUpdate = await Updates.findOne({ title });

    if (existingUpdate) {
      return res
        .status(400)
        .json({ success: false, message: "this update already exists" });
    }

    const thumbnailResult = await Cloudinary.v2.uploader.upload(
      req.files.thumbnail[0].path,
      {
        folder: "updates/thumbnail",
      }
    );

    const imageResult = await Cloudinary.v2.uploader.upload(
      req.files.image[0].path,
      {
        folder: "updates/images",
      }
    );

    
    const newUpdate = await Updates.create({
      title: title.trim(),
      description,
      thumbnail: {
        public_id: thumbnailResult.public_id,
        url: thumbnailResult.secure_url,
      },
      image: {
        public_id: imageResult.public_id,
        url: imageResult.secure_url,
      },
      category,
    });

    return res.status(200).json({
      success: true,
      update: newUpdate,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server error", error: error.message });
    console.error("membership updates creation failed", error);
  }
};

const getAllUpdates = async (req, res) => {
  try {
    const allUpdates = await Updates.find();

    return res.status(200).json({
      success: true,
      message: "Updates data",
      updates: allUpdates,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server error", error: error.message });
    console.error("failed to fetch all updates", error);
  }
};

module.exports = { createUpdates, getAllUpdates };

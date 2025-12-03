const OfferCategory = require("../models/Offercategory.model");
const Cloudinary = require("cloudinary");

const createOfferCategory = async (req, res) => {
  try {
    const { title, items } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "title is required",
      });
    }

    if (!req.files || !req.files.thumbnail || !req.files.thumbnail[0]) {
      return res.status(400).json({
        success: false,
        message: "Please upload offer category thumbnail",
      });
    }

    const thumbnailResult = await Cloudinary.v2.uploader.upload(
      req.files.thumbnail[0].path,
      {
        folder: "offers/category",
      }
    );

    let itemsArray = [];

    if (items) {
      const parsedItems = typeof items === "string" ? JSON.parse(items) : items;

      itemsArray = parsedItems.map((item) => ({
        name: item.name,
        inventory: item.inventory || 0,
        usedCount: item.usedCount || 0,
      }));
    }

    const category = await OfferCategory.create({
      title,
      thumbnail: {
        public_id: thumbnailResult.public_id,
        url: thumbnailResult.secure_url,
      },
      items: itemsArray,
    });

    return res.status(200).json({
      success: true,
      message: "Offer created successfully",
      category,
    });
  } catch (error) {
    console.error("Offer creation failed:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const getAllOffers = async (req, res) => {
  try {
    const offers = await OfferCategory.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      offers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getOfferById = async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await OfferCategory.findById(id);

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    res.status(200).json({
      success: true,
      offer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { createOfferCategory, getAllOffers, getOfferById };

const Offer = require("../models/Offer.model");
const Cloudinary = require("cloudinary");

const createOffers = async (req, res) => {
  try {
    const {
      offertitle,
      offerDescription,
      offerIncludes,
      inventory,
      usedCount,
    } = req.body;

    if (!offertitle) {
      return res.status(400).json({
        success: false,
        message: "offertitle is required",
      });
    }

    if (!req.files || !req.files.offerThumbnail) {
      return res
        .status(400)
        .json({ success: false, message: "Please upload offer thumbnail" });
    }

    const thumbnailResult = await Cloudinary.v2.uploader.upload(
      req.files.offerThumbnail[0].path,
      {
        folder: "offers/thumbnails",
      }
    );

    let includesArray = [];

    if (offerIncludes) {
      if (Array.isArray(offerIncludes)) {
        includesArray = offerIncludes;
      } else {
        includesArray = offerIncludes.split(",").map((i) => i.trim());
      }
    }

    const offer = await Offer.create({
      offertitle: offertitle.trim(),
      offerDescription: offerDescription || null,
      offerThumbnail: {
        public_id: thumbnailResult.public_id,
        url: thumbnailResult.secure_url,
      },
      offerIncludes: includesArray,
      inventory: inventory || null,
      usedCount: usedCount || 0,
    });
    return res.status(200).json({
      success: true,
      message: "Offer created successfully",
      newOffer: offer,
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
    const offers = await Offer.find().sort({ createdAt: -1 });

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

    const offer = await Offer.findById(id);

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

module.exports = { createOffers, getAllOffers, getOfferById };

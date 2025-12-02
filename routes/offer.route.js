const upload = require("../config/multerConfig");
const {
  getOfferById,
  createOfferCategory,
} = require("../controllers/offer.controller");

const offerRouter = require("express").Router();

offerRouter.post(
  "/add",
  upload.fields([{ name: "offerThumbnail", maxCount: 1 }]),
  createOfferCategory
);
offerRouter.get("/:id", getOfferById);

module.exports = { offerRouter };

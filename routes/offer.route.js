const upload = require("../config/multerConfig");
const {
  createOffers,
  getOfferById,
} = require("../controllers/offer.controller");

const offerRouter = require("express").Router();

offerRouter.post(
  "/add",
  upload.fields([{ name: "offerThumbnail", maxCount: 1 }]),
  createOffers
);
offerRouter.get("/:id", getOfferById);

module.exports = { offerRouter };

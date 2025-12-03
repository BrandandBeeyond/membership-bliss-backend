const upload = require("../config/multerConfig");
const {
  getOfferById,
  createOfferCategory,
  getAllOffers,
} = require("../controllers/offer.controller");

const offerRouter = require("express").Router();

offerRouter.post(
  "/add",
  upload.fields([{ name: "thumbnail", maxCount: 1 }]),
  createOfferCategory
);
offerRouter.get('/getall',getAllOffers);
offerRouter.get("/:id", getOfferById);

module.exports = { offerRouter };

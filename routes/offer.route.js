const {
  createOffers,
  getOfferById,
} = require("../controllers/offer.controller");

const offerRouter = require("express").Router();

offerRouter.post("/add", createOffers);
offerRouter.get("/:id", getOfferById);

module.exports = { offerRouter };

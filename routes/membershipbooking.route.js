const {
  VerifyPaymentandCreateBooking,
} = require("../controllers/membershipbooking.controller");

const membershipbookingRouter = require("express").Router();

membershipbookingRouter.post("/add", VerifyPaymentandCreateBooking);

module.exports = { membershipbookingRouter };

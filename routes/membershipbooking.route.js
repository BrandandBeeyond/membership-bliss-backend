const {
  VerifyPaymentandCreateBooking,
} = require("../controllers/membershipbooking.controller");

const membershipbookingRouter = require("express").Router();

membershipbookingRouter.post("/booking/create", VerifyPaymentandCreateBooking);

module.exports = { membershipbookingRouter };

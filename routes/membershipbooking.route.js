const {
  VerifyPaymentandCreateBooking,
} = require("../controllers/membershipbooking.controller");
const { isAuth } = require("../middlewares/middleware");

const membershipbookingRouter = require("express").Router();

membershipbookingRouter.post(
  "/booking/create",
  isAuth,
  VerifyPaymentandCreateBooking
);

module.exports = { membershipbookingRouter };

const {
  VerifyPaymentandCreateBooking,
  getbookedMembershipDetail,
} = require("../controllers/membershipbooking.controller");
const { isAuth } = require("../middlewares/middleware");

const membershipbookingRouter = require("express").Router();

membershipbookingRouter.post(
  "/booking/create",
  isAuth,
  VerifyPaymentandCreateBooking
);

membershipbookingRouter.get("/booking/my", getbookedMembershipDetail);

module.exports = { membershipbookingRouter };

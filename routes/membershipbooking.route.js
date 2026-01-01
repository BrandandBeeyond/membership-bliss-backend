const {
  VerifyPaymentandCreateBooking,
  getbookedMembershipDetail,
  getUserBookings,
} = require("../controllers/membershipbooking.controller");
const { isAuth } = require("../middlewares/middleware");

const membershipbookingRouter = require("express").Router();

membershipbookingRouter.post(
  "/booking/create",
  isAuth,
  VerifyPaymentandCreateBooking
);

membershipbookingRouter.get("/booking/my", isAuth, getbookedMembershipDetail);
membershipbookingRouter.get("/userbookings/all", isAuth, getUserBookings);

module.exports = { membershipbookingRouter };

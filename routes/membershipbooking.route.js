const {
  VerifyPaymentandCreateBooking,
  getbookedMembershipDetail,
  getUserBookings,
  getAllBookings,
  requestUserArrival,
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
membershipbookingRouter.post("/request-arrival", isAuth, requestUserArrival);

// for admin panel
membershipbookingRouter.get("/allbookings", getAllBookings);

module.exports = { membershipbookingRouter };

const {
  VerifyPaymentandCreateBooking,
  getbookedMembershipDetail,
  getUserBookings,
  getAllBookings,
  requestUserArrival,
  updateArrivalStatus,
  getActiveMembership,
  cancelUserArrivalRequest,
} = require("../controllers/membershipbooking.controller");
const { ProtectedAdmin, AuthorizeRoles } = require("../middlewares/admin.auth");
const { isAuth } = require("../middlewares/middleware");

const membershipbookingRouter = require("express").Router();

membershipbookingRouter.post(
  "/booking/create",
  isAuth,
  VerifyPaymentandCreateBooking,
);

membershipbookingRouter.get("/booking/my", isAuth, getbookedMembershipDetail);
membershipbookingRouter.get("/userbookings/all", isAuth, getUserBookings);
membershipbookingRouter.post("/request-arrival", isAuth, requestUserArrival);

membershipbookingRouter.post(
  "/cancel-user-arrival",
  isAuth,
  cancelUserArrivalRequest,
);

membershipbookingRouter.get("/active", isAuth, getActiveMembership);

// for admin panel
membershipbookingRouter.get("/allbookings", getAllBookings);
membershipbookingRouter.put(
  "/membership/:id/arrival",
  ProtectedAdmin,
  AuthorizeRoles("SUPER_ADMIN", "ADMIN"),
  updateArrivalStatus,
);

module.exports = { membershipbookingRouter };

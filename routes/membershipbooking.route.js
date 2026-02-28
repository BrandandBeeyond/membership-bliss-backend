const {
  VerifyPaymentandCreateBooking,
  getbookedMembershipDetail,
  getUserBookings,
  getAllBookings,
  requestUserArrival,
  updateArrivalStatus,
  getActiveMembership,
  cancelUserArrivalRequest,
  requestphysicalCard,
  updateBookingPaymentStatus,
  completeOnlinePaymentReplacingCash,
  createOfflineBookingByAdmin,
} = require("../controllers/membershipbooking.controller");

const { ProtectedAdmin, AuthorizeRoles } = require("../middlewares/admin.auth");
const { isAuth } = require("../middlewares/middleware");

const membershipbookingRouter = require("express").Router();

membershipbookingRouter.post(
  "/booking/create",
  isAuth,
  VerifyPaymentandCreateBooking,
);
membershipbookingRouter.post(
  "/booking/complete-online-payment",
  isAuth,
  completeOnlinePaymentReplacingCash,
);
membershipbookingRouter.post(
  "/booking/offline/create",
  ProtectedAdmin,
  AuthorizeRoles("SUPER_ADMIN", "ADMIN"),
  createOfflineBookingByAdmin,
);

membershipbookingRouter.get("/booking/my", isAuth, getbookedMembershipDetail);
membershipbookingRouter.get("/userbookings/all", isAuth, getUserBookings);
membershipbookingRouter.post("/request-arrival", isAuth, requestUserArrival);

membershipbookingRouter.post(
  "/cancel-user-arrival",
  isAuth,
  cancelUserArrivalRequest,
);
membershipbookingRouter.post("/request-physical-card", isAuth, requestphysicalCard);

membershipbookingRouter.get("/active", isAuth, getActiveMembership);

// for admin panel
membershipbookingRouter.get("/allbookings", getAllBookings);
membershipbookingRouter.put(
  "/membership/:id/arrival",
  ProtectedAdmin,
  AuthorizeRoles("SUPER_ADMIN", "ADMIN"),
  updateArrivalStatus,
);
membershipbookingRouter.put(
  "/membership/:id/payment-status",
  ProtectedAdmin,
  AuthorizeRoles("SUPER_ADMIN", "ADMIN"),
  updateBookingPaymentStatus,
);

module.exports = { membershipbookingRouter };

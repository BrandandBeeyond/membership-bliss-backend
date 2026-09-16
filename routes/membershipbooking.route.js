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
  claimMembership,
  generateOfflineClaimCode,
} = require("../controllers/membershipbooking.controller");

const { ProtectedAdmin, AuthorizeRoles } = require("../middlewares/admin.auth");
const { isAuth } = require("../middlewares/middleware");

const { makeDeleteOfflineBooking } = require("../services/offline-booking-delete");
const MembershipBooking = require("../models/MembershipBooking.model");
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
membershipbookingRouter.post("/booking/claim-membership", isAuth, claimMembership);

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
membershipbookingRouter.delete("/booking/offline/:id", ProtectedAdmin, AuthorizeRoles("SUPER_ADMIN", "ADMIN"), makeDeleteOfflineBooking({ MembershipBooking }));
membershipbookingRouter.get("/allbookings", ProtectedAdmin, AuthorizeRoles("SUPER_ADMIN", "ADMIN", "COUNTER_STAFF"), getAllBookings);
membershipbookingRouter.post("/booking/offline/:id/claim-code", ProtectedAdmin, AuthorizeRoles("SUPER_ADMIN", "ADMIN"), generateOfflineClaimCode);
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

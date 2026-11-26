const {
  createVoucherRedeemtion,
  resendVerifyVoucherCode,
  checkVoucherPendingRedemption,
  getAllRedeemVoucherRequests,
  approveVoucherRedeemptionWithCode,
  rejectVoucherRedemption,
  getMemberVoucherBalance,
  manualRedeemVouchers,
} = require("../controllers/voucher.controller");
const { ProtectedAdmin, AuthorizeRoles } = require("../middlewares/admin.auth");

const voucherRouter = require("express").Router();

voucherRouter.post("/voucher/redeem", createVoucherRedeemtion);

voucherRouter.post("/voucher/redeem/resend-code", resendVerifyVoucherCode);
voucherRouter.get(
  "/voucher/redeem/check-pending",
  checkVoucherPendingRedemption
);

voucherRouter.get(
  "/getall",
  ProtectedAdmin,
  AuthorizeRoles("SUPER_ADMIN", "ADMIN"),
  getAllRedeemVoucherRequests
);

voucherRouter.get(
  "/member-balance",
  ProtectedAdmin,
  AuthorizeRoles("SUPER_ADMIN", "ADMIN"),
  getMemberVoucherBalance
);

voucherRouter.post(
  "/voucher/redeem/manual",
  ProtectedAdmin,
  AuthorizeRoles("SUPER_ADMIN", "ADMIN"),
  manualRedeemVouchers
);

voucherRouter.post(
  "/voucher/redeem/approve-with-code",
  ProtectedAdmin,
  AuthorizeRoles("SUPER_ADMIN", "ADMIN"),
  approveVoucherRedeemptionWithCode
);

voucherRouter.post(
  "/voucher/redeem/:id/reject",
  ProtectedAdmin,
  AuthorizeRoles("SUPER_ADMIN", "ADMIN"),
  rejectVoucherRedemption
);

module.exports = { voucherRouter };

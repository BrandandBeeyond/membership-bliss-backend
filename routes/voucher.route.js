const {
  createVoucherRedeemtion,
  resendVerifyVoucherCode,
  checkVoucherPendingRedemption,
  getAllRedeemVoucherRequests,
  approveVoucherRedeemptionWithCode,
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

voucherRouter.post(
  "/voucher/redeem/approve-with-code",
  ProtectedAdmin,
  AuthorizeRoles("SUPER_ADMIN", "ADMIN"),
  approveVoucherRedeemptionWithCode
);

module.exports = { voucherRouter };

const {
  createVoucherRedeemtion,
  verifyOtpRedeemption,
  resendVerifyVoucherCode,
  checkVoucherPendingRedemption,
  getAllRedeemVoucherRequests,
} = require("../controllers/voucher.controller");
const { ProtectedAdmin, AuthorizeRoles } = require("../middlewares/admin.auth");

const voucherRouter = require("express").Router();

voucherRouter.post("/voucher/redeem", createVoucherRedeemtion);
voucherRouter.post("/voucher/redeem/verify", verifyOtpRedeemption);
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

module.exports = { voucherRouter };

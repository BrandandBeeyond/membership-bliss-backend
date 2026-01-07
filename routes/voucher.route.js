const {
  createVoucherRedeemtion,
  verifyOtpRedeemption,
  resendVerifyVoucherCode,
  checkVoucherPendingRedemption,
} = require("../controllers/voucher.controller");

const voucherRouter = require("express").Router();

voucherRouter.post("/voucher/redeem", createVoucherRedeemtion);
voucherRouter.post("/voucher/redeem/verify", verifyOtpRedeemption);
voucherRouter.post("/voucher/redeem/resend-code", resendVerifyVoucherCode);
voucherRouter.get(
  "/voucher/redeem/check-pending",
  checkVoucherPendingRedemption
);

module.exports = { voucherRouter };

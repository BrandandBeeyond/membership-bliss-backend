const { createVoucherRedeemtion } = require("../controllers/voucher.controller");

const voucherRouter = require("express").Router();

voucherRouter.post('/create',createVoucherRedeemtion);

module.exports = {voucherRouter}
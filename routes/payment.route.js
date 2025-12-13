const { createPaymentOrder } = require("../controllers/payment.controller");

const paymentRouter = require("express").Router();

paymentRouter.post("/create-order", createPaymentOrder);

module.exports = { paymentRouter };

const {
  googleLogin,
  SendOtp,
  VerifyOtp,
} = require("../controllers/user.controller");

const userRouter = require("express").Router();

userRouter.post("/google-login", googleLogin);
userRouter.post("/send-otp", SendOtp);
userRouter.post("/verify-otp", VerifyOtp);

module.exports = userRouter;

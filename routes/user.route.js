const {
  googleLogin,
  VerifyOtp,
  logoutUser,
  sendOTP,
} = require("../controllers/user.controller");

const userRouter = require("express").Router();

userRouter.post("/google-login", googleLogin);
userRouter.post("/send-otp", sendOTP);
// userRouter.post("/verify-otp", VerifyOtp);
userRouter.post("/logout", logoutUser);

module.exports = userRouter;

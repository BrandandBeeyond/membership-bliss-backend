const {
  googleLogin,
  VerifyOtp,
  logoutUser,
  sendOTP,
  verifyOTP,
  completeUserProfile,
} = require("../controllers/user.controller");

const userRouter = require("express").Router();

userRouter.post("/google-login", googleLogin);
userRouter.post("/send-otp", sendOTP);
userRouter.post("/verify-otp", verifyOTP);
userRouter.post("/complete-profile", completeUserProfile);
userRouter.post("/logout", logoutUser);

module.exports = userRouter;

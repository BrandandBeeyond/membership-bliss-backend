const {
  googleLogin,
  VerifyOtp,
  logoutUser,
  sendOTP,
  verifyOTP,
  completeUserProfile,
  saveFcmToken,
} = require("../controllers/user.controller");
const { isAuth } = require("../middlewares/middleware");

const userRouter = require("express").Router();

userRouter.post("/google-login", googleLogin);
userRouter.post("/send-otp", sendOTP);
userRouter.post("/verify-otp", verifyOTP);
userRouter.post("/complete-profile", isAuth, completeUserProfile);
userRouter.post("/save-fcm-token", isAuth, saveFcmToken);
userRouter.post("/logout", logoutUser);

module.exports = userRouter;

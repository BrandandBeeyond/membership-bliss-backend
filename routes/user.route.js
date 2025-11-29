const {
  googleLogin,
  SendOtp,
  VerifyOtp,
  logoutUser,
} = require("../controllers/user.controller");

const userRouter = require("express").Router();

userRouter.post("/google-login", googleLogin);
userRouter.post("/send-otp", SendOtp);
userRouter.post("/verify-otp", VerifyOtp);
userRouter.post("/logout", logoutUser);

module.exports = userRouter;

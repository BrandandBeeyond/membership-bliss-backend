const { sendNotifications } = require("../controllers/notification.controller");
const { ProtectedAdmin } = require("../middlewares/admin.auth");

const NotificationRouter = require("express").Router();

NotificationRouter.post(
  "/send-notification",
  ProtectedAdmin,
  sendNotifications,
);

module.exports = { NotificationRouter };

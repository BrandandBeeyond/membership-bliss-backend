const {
  getAllNotifications,
  markNotificationRead,
  clearAllNotifications,
} = require("../controllers/InternalNotification.controller");
const { sendNotifications } = require("../controllers/notification.controller");
const { ProtectedAdmin } = require("../middlewares/admin.auth");
const { isAuth } = require("../middlewares/middleware");

const NotificationRouter = require("express").Router();

NotificationRouter.post(
  "/send-notification",
  ProtectedAdmin,
  sendNotifications,
);

NotificationRouter.get("/internal/all", isAuth, getAllNotifications);
NotificationRouter.put("/:id/read", isAuth, markNotificationRead);
NotificationRouter.delete("/clearall", isAuth, clearAllNotifications);

module.exports = { NotificationRouter };

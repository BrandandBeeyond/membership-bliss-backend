const InternalNotification = require("../models/InternalNotification.model");

const getAllNotifications = async (req, res) => {
  try {
    const allnotifications = await InternalNotification.find({
      user: req.user._id,
    }).sort({ createdAt: -1 });

    if (!allnotifications) {
      return res
        .status(400)
        .json({ success: false, message: "no notifications found" });
    }

    return res.status(200).json({
      success: true,
      allnotifications: allnotifications || [],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await InternalNotification.findById(id);

    if (!notification) {
      return res
        .status(400)
        .json({ success: false, message: "No Notification found" });
    }

    if (notification.user.toString() !== req.user._id.toString()) {
      return res
        .status(400)
        .json({ success: false, message: "Not Authorized" });
    }

    notification.isRead = true;
    await notification.save();

    return res.json({ success: true, id: notification._id });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const clearAllNotifications = async (req, res) => {
  try {
    await InternalNotification.deleteMany({ user: req.user._id });

    return res.json({ success: true, message: "notifications are cleared" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllNotifications,
  markNotificationRead,
  clearAllNotifications,
};

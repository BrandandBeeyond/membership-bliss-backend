const Notification = require("../models/Notification.model");
const User = require("../models/User.model");

const sendNotifications = async (req, res) => {
  try {
    const { title, body, type, userIds, scheduledAt } = req.body;

    const notification = await Notification.create({
      title,
      body,
      type,
      userIds: type === "USER_SPECIFIC" ? userIds : [],
      scheduledAt,
      createdBy: req.adminId,
    });

    let users;

    if (type === "GLOBAL") {
      users = await User.find({});
    } else {
      users = await User.find({ _id: { $in: userIds } });
    }

    const tokens = users.map((u) => u.fcmToken).filter(Boolean);

    const message = {
      notification: {
        title,
        body,
      },
      tokens,
    };

    await admin.messaging().sendEachForMulticast(message);

    notification.sent = true;

    await notification.save();

    return res.status(200).json({
      success: true,
      message: "Notification sent successfully",
      notification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { sendNotifications };

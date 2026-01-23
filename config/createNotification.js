const InternalNotification = require("../models/InternalNotification.model");

export const createNotification = async ({
  userId,
  title,
  message,
  type = "general",
}) => {
  try {
    await InternalNotification.create({
      user: userId,
      title,
      message,
      type,
    });
  } catch (error) {
    console.error("Notification Error:", error.message);
  }
};

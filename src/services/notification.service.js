const httpStatus = require("http-status");
const { Notification, User } = require("../models");
const ApiError = require("../utils/ApiError");
const logger = require("../config/logger");
const { sendPushToToken } = require("./push.service");

// Fire-and-forget from the caller's perspective: a lead, a reply, or a
// subscription decision has already happened by the time this runs, so a
// failure here must not undo or fail that action - it only means the bell
// icon (and/or a push) misses one entry.
const createNotification = async (data) => {
  const notification = await Notification.create(data);

  try {
    const user = await User.findById(data.userId).select("fcmToken");
    if (user?.fcmToken) {
      await sendPushToToken(user.fcmToken, {
        title: data.title,
        body: data.content,
        data: {
          notificationId: notification._id.toString(),
          type: data.type || "",
        },
      });
    }
  } catch (err) {
    logger.error("Failed to send push for notification %s: %s", notification._id, err.message || err);
  }

  return notification;
};

const queryNotifications = async (userId, options) => {
  const query = { userId };
  options.sortBy = options.sortBy || "createdAt:desc";
  return Notification.paginate(query, options);
};

const getUnreadCount = async (userId) =>
  Notification.countDocuments({ userId, status: "unread" });

const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOne({ _id: notificationId, userId });
  if (!notification) {
    throw new ApiError(httpStatus.NOT_FOUND, "Notification not found");
  }
  notification.status = "read";
  await notification.save();
  return notification;
};

const markAllAsRead = async (userId) => {
  await Notification.updateMany({ userId, status: "unread" }, { $set: { status: "read" } });
};

const deleteNotification = async (notificationId, userId) => {
  const notification = await Notification.findOneAndDelete({ _id: notificationId, userId });
  if (!notification) {
    throw new ApiError(httpStatus.NOT_FOUND, "Notification not found");
  }
  return notification;
};

const clearAllNotifications = async (userId) => {
  await Notification.deleteMany({ userId });
};

module.exports = {
  createNotification,
  queryNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
};

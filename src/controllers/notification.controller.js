const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const pick = require("../utils/pick");
const { notificationService } = require("../services");

const getMyNotifications = catchAsync(async (req, res) => {
  const options = pick(req.query, ["sortBy", "limit", "page"]);

  const [notifications, unreadCount] = await Promise.all([
    notificationService.queryNotifications(req.user.id, options),
    notificationService.getUnreadCount(req.user.id),
  ]);

  res.status(httpStatus.OK).json(
    response({
      message: "Notifications retrieved successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: {
        ...notifications,
        unreadCount,
      },
    })
  );
});

const markRead = catchAsync(async (req, res) => {
  const notification = await notificationService.markAsRead(req.params.id, req.user.id);
  res.status(httpStatus.OK).json(
    response({
      message: "Notification marked as read",
      status: "OK",
      statusCode: httpStatus.OK,
      data: notification,
    })
  );
});

const markAllRead = catchAsync(async (req, res) => {
  await notificationService.markAllAsRead(req.user.id);
  res.status(httpStatus.OK).json(
    response({
      message: "All notifications marked as read",
      status: "OK",
      statusCode: httpStatus.OK,
      data: {},
    })
  );
});

const deleteOne = catchAsync(async (req, res) => {
  await notificationService.deleteNotification(req.params.id, req.user.id);
  res.status(httpStatus.OK).json(
    response({
      message: "Notification deleted",
      status: "OK",
      statusCode: httpStatus.OK,
      data: {},
    })
  );
});

const clearAll = catchAsync(async (req, res) => {
  await notificationService.clearAllNotifications(req.user.id);
  res.status(httpStatus.OK).json(
    response({
      message: "All notifications cleared",
      status: "OK",
      statusCode: httpStatus.OK,
      data: {},
    })
  );
});

module.exports = {
  getMyNotifications,
  markRead,
  markAllRead,
  deleteOne,
  clearAll,
};

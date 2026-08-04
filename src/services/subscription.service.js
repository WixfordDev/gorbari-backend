const httpStatus = require("http-status");
const cron = require("node-cron");
const { Subscription, User } = require("../models");
const ApiError = require("../utils/ApiError");
const mongoose = require("mongoose");
const { getUserById } = require("./user.service");
const transactionService = require("./transaction.service");
const notificationService = require("./notification.service");
const logger = require("../config/logger");

const createSubscription = async (subscriptionBody) => {
  const subscription = await Subscription.create(subscriptionBody);
  return subscription;
};

const getSubscriptionById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Subscription ID");
  }

  const subscription = await Subscription.findOne({
    _id: id,
    isDeleted: false,
  });

  if (!subscription) {
    throw new ApiError(httpStatus.NOT_FOUND, "Subscription not found");
  }

  return subscription;
};

const updateSubscriptionById = async (subscriptionId, updateBody) => {
  if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Subscription ID");
  }

  const subscription = await Subscription.findById(subscriptionId);

  if (!subscription || subscription.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "Subscription not found");
  }

  Object.assign(subscription, updateBody);
  await subscription.save();
  return subscription;
};

const deleteSubscriptionById = async (subscriptionId) => {
  if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Subscription ID");
  }

  const subscription = await Subscription.findById(subscriptionId);

  if (!subscription || subscription.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "Subscription not found");
  }

  subscription.isDeleted = true;
  await subscription.save();
  return subscription;
};

const querySubscriptions = async (filter, options) => {
  const query = { isDeleted: false };

  for (const key of Object.keys(filter)) {
    if (filter[key] !== "") {
      if (key === "title" || key === "description" || key === "type") {
        query[key] = { $regex: filter[key], $options: "i" }; // case-insensitive search
      } else {
        query[key] = filter[key];
      }
    }
  }

  const subscriptions = await Subscription.paginate(query, options);
  return subscriptions;
};

const takeSubscriptions = async (userId, subData) => {
  const user = await getUserById(userId);

  const subscription = await getSubscriptionById(subData.subscriptionId);

  if (!subscription) {
    throw new ApiError(httpStatus.BAD_REQUEST, "subscription not found");
  }

  const startDate = new Date();
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + (subscription.days || 0));

  const subDatas = {
    user: user._id,
    subscriptionId: subData.subscriptionId,
    status: "pending",
    subscriptionLimitation: subscription.days || 0,
    subscriptionStartDate: startDate,
    subscriptionExpirationDate: expirationDate,
    type: subData.type,
    amount: subscription.amount,
    screenshot: subData.screenshot || null,
    transactionId: subData.transactionId || null,
  };

  const transaction = await transactionService.createTransaction(subDatas);

  user.subscription = {
    subscriptionId: subData.subscriptionId,
    transactionId: transaction._id,
    subscriptionExpirationDate: expirationDate,
    status: "pending",
    bostProperty: subscription.bostProperty
  };

  await user.save();

  return transaction;
};

const approvedSubscriptions = async (transactionId, approvedBy) => {
  const transaction = await transactionService.getTransactionById(
    transactionId
  );

  if (!transaction) {
    throw new ApiError(httpStatus.NOT_FOUND, "Transaction not found");
  }
  if (transaction.status !== "pending") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Transaction is not pending");
  }

  transaction.status = "completed";
  await transaction.save();

  const user = await getUserById(transaction.user);

  user.subscription = {
    ...user.subscription.toObject(),
    status: "active",
    isSubscriptionTaken: true,
  };
  await user.save();

  // The transaction is already approved, so a notification failure must not
  // undo that - it would only mean the bell icon misses this one entry.
  try {
    await notificationService.createNotification({
      userId: user._id,
      sendBy: approvedBy,
      title: "Subscription approved",
      content: "Your subscription payment has been approved and is now active.",
      type: "subscription",
      priority: "high",
    });
  } catch (err) {
    logger.error("Failed to create subscription-approved notification: %s", err.message || err);
  }

  return transaction;
};

const rejectSubscriptions = async (transactionId, rejectedBy) => {
  const transaction = await transactionService.getTransactionById(
    transactionId
  );

  if (!transaction) {
    throw new ApiError(httpStatus.NOT_FOUND, "Transaction not found");
  }
  if (transaction.status !== "pending") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Transaction is not pending");
  }

  transaction.status = "canceled";
  await transaction.save();

  const user = await getUserById(transaction.user);

  user.subscription = {
    ...user.subscription.toObject(),
    status: "canceled",
    isSubscriptionTaken: false,
  };

  await user.save();

  try {
    await notificationService.createNotification({
      userId: user._id,
      sendBy: rejectedBy,
      title: "Subscription rejected",
      content: "Your subscription payment was rejected. Please contact support or try again.",
      type: "subscription",
      priority: "high",
    });
  } catch (err) {
    logger.error("Failed to create subscription-rejected notification: %s", err.message || err);
  }

  return transaction;
};

/**
 * Notify every agent whose plan expires exactly 3 days from now.
 *
 * Matches a single calendar day rather than "expires within 3 days" so this
 * fires once per agent, not once a day for the last 3 days before expiry -
 * this job runs daily, so a wider window would repeat the same warning.
 */
const checkExpiringSubscriptions = async () => {
  const targetStart = new Date();
  targetStart.setDate(targetStart.getDate() + 3);
  targetStart.setHours(0, 0, 0, 0);

  const targetEnd = new Date(targetStart);
  targetEnd.setHours(23, 59, 59, 999);

  const users = await User.find({
    "subscription.isSubscriptionTaken": true,
    "subscription.subscriptionExpirationDate": { $gte: targetStart, $lte: targetEnd },
  }).select("_id");

  await Promise.all(
    users.map((user) =>
      notificationService
        .createNotification({
          userId: user._id,
          title: "Your plan is expiring soon",
          content: "Your subscription plan expires in 3 days. Renew now to keep your benefits.",
          type: "subscription",
          priority: "high",
        })
        .catch((err) =>
          logger.error(
            "Failed to create expiry-warning notification for %s: %s",
            user._id,
            err.message || err
          )
        )
    )
  );

  return users.length;
};

// Started once at server boot (see src/index.js). Runs daily at 9am - late
// enough that an agent checking their phone in the morning already has it.
const scheduleSubscriptionExpiryWarnings = () => {
  cron.schedule("0 9 * * *", async () => {
    try {
      const count = await checkExpiringSubscriptions();
      logger.info("[CRON] Subscription expiry warnings sent: %d", count);
    } catch (err) {
      logger.error("[CRON] Subscription expiry warning job failed: %s", err.message || err);
    }
  });
};

module.exports = {
  createSubscription,
  getSubscriptionById,
  updateSubscriptionById,
  deleteSubscriptionById,
  querySubscriptions,

  checkExpiringSubscriptions,
  scheduleSubscriptionExpiryWarnings,

  takeSubscriptions,
  approvedSubscriptions,
  rejectSubscriptions,
};

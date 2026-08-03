const httpStatus = require("http-status");
const { Subscription } = require("../models");
const ApiError = require("../utils/ApiError");
const mongoose = require("mongoose");
const { getUserById } = require("./user.service");
const transactionService = require("./transaction.service");

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

const approvedSubscriptions = async (transactionId) => {
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

  return transaction;
};

const rejectSubscriptions = async (transactionId) => {
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

  return transaction;
};

module.exports = {
  createSubscription,
  getSubscriptionById,
  updateSubscriptionById,
  deleteSubscriptionById,
  querySubscriptions,

  takeSubscriptions,
  approvedSubscriptions,
  rejectSubscriptions,
};

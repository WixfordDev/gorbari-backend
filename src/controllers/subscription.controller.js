const httpStatus = require("http-status");
const pick = require("../utils/pick");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const { subscriptionService } = require("../services");

const subscriptionCreate = catchAsync(async (req, res) => {
  const { type } = req.body;
  req.body.createdBy = req.user.id;

  if (type !== "monthly" && type !== "yearly" && type !== "weekly") {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid subscription type");
  }

  if (type === "free") {
    req.body.days = null;
  } else if (type === "monthly") {
    req.body.days = 30;
  } else if (type === "weekly") {
    req.body.days = 7;
  } else if (type === "semi-annual") {
    req.body.days = 180;
  } else if (type === "yearly") {
    req.body.days = 365;
  }

  const subscription = await subscriptionService.createSubscription(req.body);

  res.status(httpStatus.CREATED).json(
    response({
      message: "Subscription Created",
      status: "OK",
      statusCode: httpStatus.CREATED,
      data: subscription,
    })
  );
});


const subscriptionGetById = catchAsync(async (req, res) => {
  const subscription = await subscriptionService.getSubscriptionById(
    req.params.id
  );
  res.status(httpStatus.OK).json(
    response({
      message: "Subscription Retrieved",
      status: "OK",
      statusCode: httpStatus.OK,
      data: subscription,
    })
  );
});

const subscriptionUpdateById = catchAsync(async (req, res) => {
  const subscription = await subscriptionService.updateSubscriptionById(
    req.params.id,
    req.body
  );
  res.status(httpStatus.OK).json(
    response({
      message: "Subscription Updated",
      status: "OK",
      statusCode: httpStatus.OK,
      data: subscription,
    })
  );
});

const subscriptionDeleteById = catchAsync(async (req, res) => {
  const subscription = await subscriptionService.deleteSubscriptionById(
    req.params.id
  );
  res.status(httpStatus.OK).json(
    response({
      message: "Subscription Deleted",
      status: "OK",
      statusCode: httpStatus.OK,
      data: subscription,
    })
  );
});

const subscriptionList = catchAsync(async (req, res) => {
  const filter = pick(req.query, ["title", "description", "type"]);
  const options = pick(req.query, ["sortBy", "limit", "page"]);
  const result = await subscriptionService.querySubscriptions(filter, options);
  res.status(httpStatus.OK).json(
    response({
      message: "Subscriptions Retrieved",
      status: "OK",
      statusCode: httpStatus.OK,
      data: result,
    })
  );
});



const takeSubscription = catchAsync(async (req, res) => {

  if (req.file) {
    req.body.screenshot = req.file.url;
  }

  const result = await subscriptionService.takeSubscriptions(
    req.user.id,
    req.body
  );

  res.status(httpStatus.CREATED).json(
    response({
      message: "Thank you for choosing our subscription plan. Please wait for admin review.",
      status: "OK",
      statusCode: httpStatus.CREATED,
      data: result,
    })
  );
});


const approvedSubscriptions = catchAsync(async (req, res) => {
  const result = await subscriptionService.approvedSubscriptions(
    req.body.transactionId,
    req.user.id,
  );
  
  res.status(httpStatus.CREATED).json(
    response({
      message: "Subscriptin Approved.",
      status: "OK",
      statusCode: httpStatus.CREATED,
      data: result,
    })
  );
});


const rejectSubscriptions = catchAsync(async (req, res) => {
  const result = await subscriptionService.rejectSubscriptions(
    req.body.transactionId,
    req.user.id,
  );
  
  res.status(httpStatus.CREATED).json(
    response({
      message: "Subscriptin rejected.",
      status: "OK",
      statusCode: httpStatus.CREATED,
      data: {},
    })
  );
});


module.exports = {
  subscriptionCreate,
  subscriptionGetById,
  subscriptionUpdateById,
  subscriptionDeleteById,
  subscriptionList,

  takeSubscription,
  approvedSubscriptions,
  rejectSubscriptions,
};

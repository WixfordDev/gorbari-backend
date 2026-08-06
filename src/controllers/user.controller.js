const httpStatus = require("http-status");
const pick = require("../utils/pick");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const response = require("../config/response");
const { userService } = require("../services");
const { Property } = require("../models");

const createUser = catchAsync(async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(httpStatus.CREATED).json(
    response({
      message: "User Created",
      status: "OK",
      statusCode: httpStatus.CREATED,
      data: user,
    })
  );
});

const getUsers = catchAsync(async (req, res) => {
  const filter = pick(req.query, ["fullName", "email", "role", "gender"]);
  const options = pick(req.query, ["sortBy", "limit", "page"]);
  const result = await userService.queryUsers(filter, options);
  const stats = await userService.getUsersStats(filter);
  res.status(httpStatus.OK).json(
    response({
      message: "All Users",
      status: "OK",
      statusCode: httpStatus.OK,
      data: { ...result, stats },
    })
  );
});

const getPublicAgent = catchAsync(async (req, res) => {
  const filter = pick(req.query, ["fullName"]);
  const options = pick(req.query, ["sortBy", "limit", "page"]);

  filter.role = "agent";

  const result = await userService.queryUsers(filter, options);

  // Real count of each agent's own (non-deleted) listings, not a placeholder -
  // grouped in one aggregation rather than a countDocuments() per agent.
  const agentIds = result.results.map((agent) => agent._id);
  const listingCounts = await Property.aggregate([
    { $match: { createdBy: { $in: agentIds }, isDeleted: false } },
    { $group: { _id: "$createdBy", count: { $sum: 1 } } },
  ]);
  const listingCountByAgent = Object.fromEntries(
    listingCounts.map(({ _id, count }) => [_id.toString(), count])
  );

  const agents = result.results.map((agent) => ({
    id: agent._id,
    fullName: agent.fullName,
    profileImage: agent.profileImage || null,
    listings: listingCountByAgent[agent._id.toString()] || 0,
  }));

  res.status(httpStatus.OK).json(
    response({
      message: "Public agents retrieved",
      status: "OK",
      statusCode: httpStatus.OK,
      data: {
        agents,
        page: result.page,
        limit: result.limit,
        totalResults: result.totalResults,
        totalPages: result.totalPages,
      },
    })
  );
});

const getProfile = catchAsync(async (req, res) => {
  const user = await userService.getUserById(req.user.id);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "The account is deleted");
  }

  if (user.isBlocked) {
    throw new ApiError(httpStatus.NOT_FOUND, "The account is blocked");
  }

  const { securitySettings } = user;

  res.status(httpStatus.OK).json(
    response({
      message: "User Profile",
      status: "OK",
      statusCode: httpStatus.OK,
      data: { user, securitySettings },
    })
  );
});

const getUser = catchAsync(async (req, res) => {
  let user = await userService.getUserById(req.params.userId);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  res.status(httpStatus.OK).json(
    response({
      message: "User",
      status: "OK",
      statusCode: httpStatus.OK,
      data: user,
    })
  );
});

const updateUser = catchAsync(async (req, res) => {
  if (req.body.interest) {
    const parsedInterest = JSON.parse(req.body.interest);
    req.body.interest = parsedInterest;
  }
  const image = {};
  if (req.file) {
    image.url = req.file.url;
    image.path = req.file.path;
  }
  if (req.file) {
    req.body.image = image;
  }

  const user = await userService.updateUserById(req.params.userId, req.body);

  res.status(httpStatus.OK).json(
    response({
      message: "User Updated",
      status: "OK",
      statusCode: httpStatus.OK,
      data: user,
    })
  );
});

const updateProfile = catchAsync(async (req, res) => {
  if (req.file) {
    req.body.profileImage = req.file.url;
  }

  // Set fullName if firstName or lastName is provided
  if (!req.body.fullName && (req.body.firstName || req.body.lastName)) {
    req.body.fullName = `${req.body.firstName || ""} ${
      req.body.lastName || ""
    }`.trim();
  }

  const user = await userService.updateUserById(req.user.id, req.body);

  res.status(httpStatus.OK).json(
    response({
      message: "User Updated",
      status: "OK",
      statusCode: httpStatus.OK,
      data: user,
    })
  );
});

const updateFcmToken = catchAsync(async (req, res) => {
  await userService.updateUserById(req.user.id, { fcmToken: req.body.fcmToken });

  res.status(httpStatus.OK).json(
    response({
      message: "Device registered for notifications",
      status: "OK",
      statusCode: httpStatus.OK,
      data: {},
    })
  );
});

const deleteUser = catchAsync(async (req, res) => {
  await userService.deleteUserById(req.params.userId);
  res.status(httpStatus.OK).json(
    response({
      message: "User Deleted",
      status: "OK",
      statusCode: httpStatus.OK,
      data: {},
    })
  );
});

module.exports = {
  createUser,
  getUsers,
  getUser,
  getProfile,
  updateUser,
  updateProfile,
  updateFcmToken,
  deleteUser,
  getPublicAgent
};

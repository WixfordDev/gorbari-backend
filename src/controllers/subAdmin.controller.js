const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const response = require("../config/response");
const { userService, emailService } = require("../services");
const { User } = require("../models");
const { SUB_ADMIN_PERMISSIONS } = require("../config/roles");

const inviteSubAdmin = catchAsync(async (req, res) => {
  const { email, password, permissions, fullName } = req.body;

  if (!email || !password) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Email and password are required");
  }

  const invalidPermissions = (permissions || []).filter((p) => !SUB_ADMIN_PERMISSIONS.includes(p));
  if (invalidPermissions.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Invalid permissions: ${invalidPermissions.join(", ")}`);
  }

  const existing = await userService.getUserByEmail(email);
  if (existing && !existing.isDeleted) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Email already taken");
  }

  const subAdmin = await User.create({
    email,
    password,
    fullName: fullName || email.split("@")[0],
    role: "subAdmin",
    permissions: permissions || [],
    isEmailVerified: true,
  });

  await emailService.sendSubAdminInvitationEmail(email, password, permissions || [], fullName);

  res.status(httpStatus.CREATED).json(
    response({
      message: "Sub-admin invited successfully",
      status: "OK",
      statusCode: httpStatus.CREATED,
      data: subAdmin,
    })
  );
});

const getSubAdmins = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = { role: "subAdmin", isDeleted: false };

  const [subAdmins, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select("-password"),
    User.countDocuments(filter),
  ]);

  res.status(httpStatus.OK).json(
    response({
      message: "Sub-admins retrieved",
      status: "OK",
      statusCode: httpStatus.OK,
      data: {
        results: subAdmins,
        page,
        limit,
        totalResults: total,
        totalPages: Math.ceil(total / limit),
      },
    })
  );
});

const updateSubAdminPermissions = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;

  const invalidPermissions = (permissions || []).filter((p) => !SUB_ADMIN_PERMISSIONS.includes(p));
  if (invalidPermissions.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Invalid permissions: ${invalidPermissions.join(", ")}`);
  }

  const subAdmin = await User.findOne({ _id: id, role: "subAdmin", isDeleted: false });
  if (!subAdmin) {
    throw new ApiError(httpStatus.NOT_FOUND, "Sub-admin not found");
  }

  subAdmin.permissions = permissions || [];
  await subAdmin.save();

  res.status(httpStatus.OK).json(
    response({
      message: "Permissions updated",
      status: "OK",
      statusCode: httpStatus.OK,
      data: subAdmin,
    })
  );
});

const toggleBlockSubAdmin = catchAsync(async (req, res) => {
  const { id } = req.params;

  const subAdmin = await User.findOne({ _id: id, role: "subAdmin", isDeleted: false });
  if (!subAdmin) {
    throw new ApiError(httpStatus.NOT_FOUND, "Sub-admin not found");
  }

  subAdmin.isBlocked = !subAdmin.isBlocked;
  await subAdmin.save();

  res.status(httpStatus.OK).json(
    response({
      message: `Sub-admin ${subAdmin.isBlocked ? "blocked" : "unblocked"} successfully`,
      status: "OK",
      statusCode: httpStatus.OK,
      data: subAdmin,
    })
  );
});

const deleteSubAdmin = catchAsync(async (req, res) => {
  const { id } = req.params;

  const subAdmin = await User.findOne({ _id: id, role: "subAdmin", isDeleted: false });
  if (!subAdmin) {
    throw new ApiError(httpStatus.NOT_FOUND, "Sub-admin not found");
  }

  subAdmin.isDeleted = true;
  await subAdmin.save();

  res.status(httpStatus.OK).json(
    response({
      message: "Sub-admin deleted successfully",
      status: "OK",
      statusCode: httpStatus.OK,
      data: {},
    })
  );
});

module.exports = {
  inviteSubAdmin,
  getSubAdmins,
  updateSubAdminPermissions,
  toggleBlockSubAdmin,
  deleteSubAdmin,
};

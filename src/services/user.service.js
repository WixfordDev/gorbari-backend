const httpStatus = require("http-status");
const { User } = require("../models");
const ApiError = require("../utils/ApiError");
const { generateOneTimeCode } = require("../utils/oneTimeCode");
const { sendEmailVerification, sendNewUserRegistrationEmail, sendEmailInBackground } = require("./email.service");
const config = require("../config/config");

// The account is already created, so a mail failure must not fail the request -
// notify in the background and let the service log any problem. Shared by
// createUser (brand-new account) and isUpdateUser (re-created account).
const sendAdminNewUserAlert = (user) => {
  if (!config.email.contactUsRecipient) return;
  sendEmailInBackground(() =>
    sendNewUserRegistrationEmail(config.email.contactUsRecipient, {
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      phoneNumber: user.phoneNumber,
    })
  );
};

const createUser = async (userBody) => {
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Email already taken");
  }
  const { oneTimeCode, oneTimeCodeExpires } = generateOneTimeCode();

  const user = await User.create({ ...userBody, oneTimeCode, oneTimeCodeExpires });

  // Awaited on purpose: without this code the account cannot be verified, so a
  // delivery failure has to reach the client instead of leaving them waiting
  // for an email that will never arrive.
  await sendEmailVerification(user.email, oneTimeCode);

  sendAdminNewUserAlert(user);

  return user;
};



// Shared by queryUsers (list pagination) and getUsersStats (header cards) so the
// two stay consistent about which users a search/role filter actually matches.
const buildUserQuery = (filter) => {
  const query = {};

  // Text fields (name/email/username) are searched with a single term that may
  // match any of them, so they are grouped under $or instead of being ANDed
  // together (the admin panel sends the same term for both name and email).
  const textSearch = [];
  for (const key of ["fullName", "email", "username"]) {
    if (filter[key] !== undefined && filter[key] !== "") {
      textSearch.push({ [key]: { $regex: filter[key], $options: "i" } });
    }
  }
  if (textSearch.length > 0) {
    query.$or = textSearch;
  }

  // Remaining fields (role, gender, ...) are exact matches.
  for (const key of Object.keys(filter)) {
    if (key === "fullName" || key === "email" || key === "username") continue;
    if (filter[key] !== "") {
      query[key] = filter[key];
    }
  }

  return query;
};

const queryUsers = async (filter, options) => {
  const users = await User.paginate(buildUserQuery(filter), options);

  return users;
};

// Counts for the admin header cards. Mirrors the status logic the table uses:
// a subscription is Active while it is 'active' or 'trialing', a 'pending'
// payment has not been approved yet, and a suspended account is one flagged as
// blocked. Counts respect the same role/search filter as the table, so the
// cards always match the rows the admin is looking at.
const getUsersStats = async (filter) => {
  const [stats] = await User.aggregate([
    { $match: buildUserQuery(filter) },
    {
      $group: {
        _id: null,
        active: {
          $sum: { $cond: [{ $in: ["$subscription.status", ["active", "trialing"]] }, 1, 0] },
        },
        pending: {
          $sum: { $cond: [{ $eq: ["$subscription.status", "pending"] }, 1, 0] },
        },
        suspended: {
          $sum: { $cond: [{ $eq: ["$isBlocked", true] }, 1, 0] },
        },
      },
    },
  ]);

  return {
    active: stats?.active || 0,
    pending: stats?.pending || 0,
    suspended: stats?.suspended || 0,
  };
};



const getUserById = async (id) => {
  return User.findById(id);
};

const getUserByEmail = async (email) => {
  return User.findOne({ email });
};

const updateUserById = async (userId, updateBody, files) => {
  const user = await getUserById(userId);

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Email already taken");
  }

  if (files && files.length > 0) {
    updateBody.photo = files;
  } else {
    delete updateBody.photo; // remove the photo property from the updateBody if no new photo is provided
  }

  Object.assign(user, updateBody);
  await user.save();
  return user;
};

const deleteUserById = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }
  await user.deleteOne();
  return user;
};

const isUpdateUser = async (userId, updateBody) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const { oneTimeCode, oneTimeCodeExpires } = generateOneTimeCode();

  Object.assign(user, updateBody, {
    isDeleted: false,
    isSuspended: false,
    isEmailVerified: false,
    isResetPassword: false,
    isPhoneNumberVerified: false,
    oneTimeCode,
    oneTimeCodeExpires,
  });
  await user.save();

  // Awaited for the same reason as in createUser: the code is the only way to
  // finish verifying this account.
  await sendEmailVerification(user.email, oneTimeCode);

  // A re-created account is still a new signup worth surfacing to the admin.
  sendAdminNewUserAlert(user);

  return user;
};

/**
 * Issue a fresh verification code to an account that has not been verified yet.
 *
 * Registration is the only other place a verification code is created, so
 * without this an account whose first email was lost would be permanently
 * stuck.
 */
const resendEmailVerification = async (email) => {
  const user = await getUserByEmail(email);
  if (!user || user.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "No users found with this email");
  }
  if (user.isEmailVerified) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Email already verified");
  }

  const { oneTimeCode, oneTimeCodeExpires } = generateOneTimeCode();
  user.oneTimeCode = oneTimeCode;
  user.oneTimeCodeExpires = oneTimeCodeExpires;
  await user.save();

  await sendEmailVerification(user.email, oneTimeCode);

  return user;
};

module.exports = {
  createUser,
  queryUsers,
  getUsersStats,
  getUserById,
  getUserByEmail,
  updateUserById,
  deleteUserById,
  isUpdateUser,
  resendEmailVerification,
};
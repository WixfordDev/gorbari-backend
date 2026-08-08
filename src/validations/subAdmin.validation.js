const Joi = require("joi");
const { objectId, password } = require("./custom.validation");
const { SUB_ADMIN_PERMISSIONS } = require("../config/roles");

// The controller already re-checks `permissions` against this same list, but
// that check assumes an array and crashes with an uncaught 500 if the caller
// sends anything else (a bare string, a number, ...) - validating the shape
// here up front closes that, on top of giving a clean 400 either way.
const permissionsArray = Joi.array().items(Joi.string().valid(...SUB_ADMIN_PERMISSIONS));

const inviteSubAdmin = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    password: Joi.string().required().custom(password),
    fullName: Joi.string(),
    permissions: permissionsArray,
  }),
};

const updateSubAdminPermissions = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    permissions: permissionsArray.required(),
  }),
};

const subAdminIdParam = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
};

module.exports = {
  inviteSubAdmin,
  updateSubAdminPermissions,
  subAdminIdParam,
};

const Joi = require("joi");
const { objectId } = require("./custom.validation");

// `logo` is deliberately absent here: it arrives via multer as `req.file`,
// not in `req.body`, and only gets copied into the body inside the
// controller - after this validation already ran.
const createGateway = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    address: Joi.string().required(),
    status: Joi.string().valid("active", "inactive"),
  }),
};

const updateGateway = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    name: Joi.string(),
    address: Joi.string(),
    status: Joi.string().valid("active", "inactive"),
  }),
};

const gatewayIdParam = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
};

module.exports = {
  createGateway,
  updateGateway,
  gatewayIdParam,
};

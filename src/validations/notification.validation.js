const Joi = require("joi");
const { objectId } = require("./custom.validation");

const notificationIdParam = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
};

module.exports = {
  notificationIdParam,
};

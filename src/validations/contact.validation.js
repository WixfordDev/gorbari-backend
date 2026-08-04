const Joi = require("joi");
const { objectId } = require("./custom.validation");

/**
 * Site-wide contact form. Unauthenticated, so the sender has to identify
 * themselves in the body.
 */
const createContact = {
  body: Joi.object().keys({
    type: Joi.string().valid("general").default("general"),
    fullName: Joi.string().trim().max(120).allow(""),
    firstName: Joi.string().trim().max(60).allow(""),
    lastName: Joi.string().trim().max(60).allow(""),
    email: Joi.string().email().required(),
    // Optional in the form (no required-field marker in the UI), so an empty
    // string from a field the visitor left blank must be accepted, not
    // rejected - Joi treats "" as invalid for a plain .string() by default.
    phoneNumber: Joi.string().trim().max(30).allow(""),
    address: Joi.string().trim().max(200).allow(""),
    message: Joi.string().trim().min(1).max(2000).required(),
  }),
};

/**
 * Property enquiry. Requires auth, so identity comes from the token and any
 * client-supplied name or email is ignored by the controller.
 */
const createPropertyContact = {
  body: Joi.object().keys({
    type: Joi.string().valid("property").required(),
    property: Joi.string().custom(objectId).required(),
    propertyWoner: Joi.string().custom(objectId).required(),
    intent: Joi.string()
      .valid("general", "buy", "rent", "lease", "auction", "visit")
      .default("general"),
    message: Joi.string().trim().min(1).max(2000).required(),
    phoneNumber: Joi.string().trim().max(30),
  }),
};

const updateContactStatus = {
  params: Joi.object().keys({
    contactId: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    status: Joi.string().valid("new", "seen", "replied").required(),
  }),
};

const replyToContact = {
  params: Joi.object().keys({
    contactId: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    message: Joi.string().trim().min(1).max(2000).required(),
  }),
};

module.exports = {
  createContact,
  createPropertyContact,
  updateContactStatus,
  replyToContact,
};

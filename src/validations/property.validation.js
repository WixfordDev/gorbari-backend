const Joi = require("joi");
const { objectId } = require("./custom.validation");
const { DIVISION_NAMES } = require("../config/bangladeshGeo");

// Requests arrive as multipart/form-data (images ride alongside these
// fields), so every value here is a string regardless of what it logically
// represents - normalizeOptionalNumbers() in property.service.js is what
// actually coerces the numeric-looking ones, not this schema. This schema's
// job is narrower: reject genuinely malformed/missing required fields, and -
// just as importantly - refuse to forward server-only fields at all.
// `createProperty`/`updatePropertyById` spread the request body straight into
// the document, so without an explicit whitelist here a caller could set
// `isBosted`, `commission`, `views`, `bostedRank`, etc. directly and bypass
// the subscription/boost-credit system entirely.
const optionalTextFields = {
  description: Joi.string().allow(""),
  catagory: Joi.string().valid("House", "Apartment", "Condo", "Land", "Commercial", "Other"),
  division: Joi.string().valid(...DIVISION_NAMES, ""),
  district: Joi.string().allow(""),
  zipCode: Joi.string().allow(""),
  city: Joi.string().allow(""),
  state: Joi.string().allow(""),
  country: Joi.string().allow(""),
  mapLink: Joi.string().allow(""),
  price: Joi.string().allow(""),
  areaSqFt: Joi.string().allow(""),
  lotSize: Joi.string().allow(""),
  yearBuilt: Joi.string().allow(""),
  bedrooms: Joi.string().allow(""),
  bathrooms: Joi.string().allow(""),
  kitchen: Joi.string().allow(""),
  garage: Joi.string().allow(""),
  status: Joi.string().valid("Available", "Sold", "Pending", "Rented", "Off-Market"),
  // JSON-stringified by the client; parsed later in the controller, so this
  // only needs to be a string at the validation stage.
  features: Joi.string().allow(""),
  other: Joi.string().allow(""),
};

const createProperty = {
  body: Joi.object().keys({
    ...optionalTextFields,
    title: Joi.string().trim().required(),
    type: Joi.string().valid("Buy", "Rent", "Lease", "Auction").required(),
    address: Joi.string().trim().required(),
  }),
};

const updateProperty = {
  params: Joi.object().keys({
    propertyId: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    ...optionalTextFields,
    title: Joi.string().trim(),
    type: Joi.string().valid("Buy", "Rent", "Lease", "Auction"),
    address: Joi.string().trim(),
    // JSON-stringified arrays identifying which existing images to keep vs.
    // remove - only meaningful on update.
    existingImages: Joi.string().allow(""),
    deletedImages: Joi.string().allow(""),
  }),
};

const propertyIdParam = {
  params: Joi.object().keys({
    propertyId: Joi.string().custom(objectId).required(),
  }),
};

module.exports = {
  createProperty,
  updateProperty,
  propertyIdParam,
};

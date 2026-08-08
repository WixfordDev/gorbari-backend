const Joi = require("joi");
const { objectId } = require("./custom.validation");

const PAYMENT_TYPES = ["bkash", "nagad", "rocket", "surecash", "stripe", "paypal", "wise", "card"];

// createSubscriptionPlan/updateSubscriptionPlan gate access via
// checkAccess("subscription") already (admin, or a subAdmin holding that
// permission) - a much smaller trusted group than property's "any logged-in
// user". Still worth an explicit whitelist since the service spreads the body
// straight into the document either way.
const subscriptionPlanFields = {
  title: Joi.string().required(),
  subTitle: Joi.string().allow(""),
  description: Joi.string().allow(""),
  features: Joi.array().items(Joi.string()),
  type: Joi.string().valid("monthly", "yearly", "weekly").required(),
  amount: Joi.number().min(0).required(),
  days: Joi.number().min(0),
  propertyPromotionCradit: Joi.number().required(),
  propertyImageCradit: Joi.number().required(),
  propertyVideoCradit: Joi.number().required(),
  isViewsContact: Joi.boolean(),
  bostProperty: Joi.number().required(),
  bostCraditn: Joi.number(),
  isEmailSupport: Joi.boolean(),
};

const createSubscriptionPlan = {
  body: Joi.object().keys(subscriptionPlanFields),
};

const updateSubscriptionPlan = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    title: Joi.string(),
    subTitle: Joi.string().allow(""),
    description: Joi.string().allow(""),
    features: Joi.array().items(Joi.string()),
    type: Joi.string().valid("monthly", "yearly", "weekly"),
    amount: Joi.number().min(0),
    days: Joi.number().min(0),
    propertyPromotionCradit: Joi.number(),
    propertyImageCradit: Joi.number(),
    propertyVideoCradit: Joi.number(),
    isViewsContact: Joi.boolean(),
    bostProperty: Joi.number(),
    bostCraditn: Joi.number(),
    isEmailSupport: Joi.boolean(),
  }),
};

const subscriptionIdParam = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
};

// takeSubscription is multipart (a payment screenshot rides alongside), so
// this only validates the text fields - the file itself is handled by multer.
// `transactionId` here is the free-text reference number the user copies from
// their bKash/Nagad/etc. app, not a Mongo id - unlike transactionIdBody below.
const takeSubscription = {
  body: Joi.object().keys({
    subscriptionId: Joi.string().custom(objectId).required(),
    type: Joi.string().valid(...PAYMENT_TYPES).required(),
    transactionId: Joi.string().allow(""),
  }),
};

const transactionIdBody = {
  body: Joi.object().keys({
    transactionId: Joi.string().custom(objectId).required(),
  }),
};

module.exports = {
  createSubscriptionPlan,
  updateSubscriptionPlan,
  subscriptionIdParam,
  takeSubscription,
  transactionIdBody,
};

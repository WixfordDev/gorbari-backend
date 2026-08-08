const express = require("express");
const auth = require("../../middlewares/auth");
const { checkAccess } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const subscriptionValidation = require("../../validations/subscription.validation");
const { subscriptionController, transactionController } = require("../../controllers");
const userFileUploadMiddleware = require("../../middlewares/fileUpload");
const cloudinaryUpload = require("../../middlewares/cloudinaryUpload");

const uploadGateway = userFileUploadMiddleware();

const router = express.Router();

// Declared before "/:id" so the literal path is not captured as an id.
router
  .route("/transactions/me")
  .get(auth("common"), transactionController.myTransactionList);

router
  .route("/transactions")
  .get(auth("common"), checkAccess("transactionManagement"), transactionController.transactionList);

router
  .route("/")
  .get(subscriptionController.subscriptionList)
  .post(
    auth("common"),
    checkAccess("subscription"),
    validate(subscriptionValidation.createSubscriptionPlan),
    subscriptionController.subscriptionCreate
  );

router
  .route("/:id")
  .get(auth("common"), checkAccess("subscription"), validate(subscriptionValidation.subscriptionIdParam), subscriptionController.subscriptionGetById)
  .patch(
    auth("common"),
    checkAccess("subscription"),
    validate(subscriptionValidation.updateSubscriptionPlan),
    subscriptionController.subscriptionUpdateById
  )
  .delete(auth("common"), checkAccess("subscription"), validate(subscriptionValidation.subscriptionIdParam), subscriptionController.subscriptionDeleteById);

router
  .route("/take")
  .post(
    auth("common"),
    uploadGateway.single("screenshot"),
    validate(subscriptionValidation.takeSubscription),
    cloudinaryUpload("other"),
    subscriptionController.takeSubscription
  );

router
  .route("/approve")
  .post(
    auth("common"),
    checkAccess("subscription"),
    validate(subscriptionValidation.transactionIdBody),
    subscriptionController.approvedSubscriptions
  );

router
  .route("/reject")
  .post(
    auth("common"),
    checkAccess("subscription"),
    validate(subscriptionValidation.transactionIdBody),
    subscriptionController.rejectSubscriptions
  );

module.exports = router;

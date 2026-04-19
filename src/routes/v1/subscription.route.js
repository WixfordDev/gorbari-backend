const express = require("express");
const auth = require("../../middlewares/auth");
const { checkAccess } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const { subscriptionController, transactionController } = require("../../controllers");
const userFileUploadMiddleware = require("../../middlewares/fileUpload");
const convertHeicToPngMiddleware = require("../../middlewares/converter");
const UPLOADS_FOLDER_GATEWAY = "./public/uploads/other";

const uploadGateway = userFileUploadMiddleware(UPLOADS_FOLDER_GATEWAY);

const router = express.Router();

router
  .route("/transactions")
  .get(auth("common"), checkAccess("transactionManagement"), transactionController.transactionList);

router
  .route("/")
  .get(subscriptionController.subscriptionList)
  .post(auth("common"), checkAccess("subscription"), subscriptionController.subscriptionCreate);

router
  .route("/:id")
  .get(auth("common"), checkAccess("subscription"), subscriptionController.subscriptionGetById)
  .patch(auth("common"), checkAccess("subscription"), subscriptionController.subscriptionUpdateById)
  .delete(auth("common"), checkAccess("subscription"), subscriptionController.subscriptionDeleteById);

router
  .route("/take")
  .post(
    auth("common"),
    [uploadGateway.single("screenshot")],
    convertHeicToPngMiddleware(UPLOADS_FOLDER_GATEWAY),
    subscriptionController.takeSubscription
  );

router
  .route("/approve")
  .post(auth("common"), checkAccess("subscription"), subscriptionController.approvedSubscriptions);

router
  .route("/reject")
  .post(auth("common"), checkAccess("subscription"), subscriptionController.rejectSubscriptions);

module.exports = router;

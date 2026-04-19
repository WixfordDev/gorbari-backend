const express = require("express");
const auth = require("../../middlewares/auth");
const { checkAccess } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const { paymentGatewayController } = require("../../controllers");
const userFileUploadMiddleware = require("../../middlewares/fileUpload");
const convertHeicToPngMiddleware = require("../../middlewares/converter");
const UPLOADS_FOLDER_GATEWAY = "./public/uploads/other";

const uploadGateway = userFileUploadMiddleware(UPLOADS_FOLDER_GATEWAY);

const router = express.Router();

router
  .route("/")
  .get(paymentGatewayController.listGateways)
  .post(
    auth("common"), checkAccess("paymentGateways"),
    [uploadGateway.single("logo")],
    convertHeicToPngMiddleware(UPLOADS_FOLDER_GATEWAY),
    paymentGatewayController.createGateway
  );

router
  .route("/:id")
  .get(auth("common"), checkAccess("paymentGateways"), paymentGatewayController.getGatewayById)
  .patch(
    auth("common"), checkAccess("paymentGateways"),
    [uploadGateway.single("logo")],
    convertHeicToPngMiddleware(UPLOADS_FOLDER_GATEWAY),
    paymentGatewayController.updateGatewayById
  )
  .delete(auth("common"), checkAccess("paymentGateways"), paymentGatewayController.deleteGatewayById);

module.exports = router;

module.exports = router;

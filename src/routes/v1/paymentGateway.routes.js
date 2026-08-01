const express = require("express");
const auth = require("../../middlewares/auth");
const { checkAccess } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const { paymentGatewayController } = require("../../controllers");
const userFileUploadMiddleware = require("../../middlewares/fileUpload");
const cloudinaryUpload = require("../../middlewares/cloudinaryUpload");

const uploadGateway = userFileUploadMiddleware();

const router = express.Router();

router
  .route("/")
  .get(paymentGatewayController.listGateways)
  .post(
    auth("common"), checkAccess("paymentGateways"),
    uploadGateway.single("logo"),
    cloudinaryUpload("other"),
    paymentGatewayController.createGateway
  );

router
  .route("/:id")
  .get(auth("common"), checkAccess("paymentGateways"), paymentGatewayController.getGatewayById)
  .patch(
    auth("common"), checkAccess("paymentGateways"),
    uploadGateway.single("logo"),
    cloudinaryUpload("other"),
    paymentGatewayController.updateGatewayById
  )
  .delete(auth("common"), checkAccess("paymentGateways"), paymentGatewayController.deleteGatewayById);

module.exports = router;

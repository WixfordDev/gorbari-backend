const express = require("express");
const auth = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const subAdminValidation = require("../../validations/subAdmin.validation");
const subAdminController = require("../../controllers/subAdmin.controller");

const router = express.Router();

// All sub-admin management routes require admin role
router.route("/").get(auth("admin"), subAdminController.getSubAdmins);
router
  .route("/invite")
  .post(auth("admin"), validate(subAdminValidation.inviteSubAdmin), subAdminController.inviteSubAdmin);
router
  .route("/:id/permissions")
  .patch(
    auth("admin"),
    validate(subAdminValidation.updateSubAdminPermissions),
    subAdminController.updateSubAdminPermissions
  );
router
  .route("/:id/block")
  .patch(auth("admin"), validate(subAdminValidation.subAdminIdParam), subAdminController.toggleBlockSubAdmin);
router
  .route("/:id")
  .delete(auth("admin"), validate(subAdminValidation.subAdminIdParam), subAdminController.deleteSubAdmin);

module.exports = router;

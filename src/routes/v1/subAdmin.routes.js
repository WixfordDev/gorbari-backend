const express = require("express");
const auth = require("../../middlewares/auth");
const subAdminController = require("../../controllers/subAdmin.controller");

const router = express.Router();

// All sub-admin management routes require admin role
router.route("/").get(auth("admin"), subAdminController.getSubAdmins);
router.route("/invite").post(auth("admin"), subAdminController.inviteSubAdmin);
router.route("/:id/permissions").patch(auth("admin"), subAdminController.updateSubAdminPermissions);
router.route("/:id/block").patch(auth("admin"), subAdminController.toggleBlockSubAdmin);
router.route("/:id").delete(auth("admin"), subAdminController.deleteSubAdmin);

module.exports = router;

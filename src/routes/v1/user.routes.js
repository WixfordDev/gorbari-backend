const express = require("express");
const auth = require("../../middlewares/auth");
const { checkAccess } = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const userValidation = require("../../validations/user.validation");
const userController = require("../../controllers/user.controller");
const userFileUploadMiddleware = require("../../middlewares/fileUpload");
const cloudinaryUpload = require("../../middlewares/cloudinaryUpload");

const uploadUsers = userFileUploadMiddleware();

const router = express.Router();

router.route("/self/in").get(auth("common"), userController.getProfile);

router
  .route("/self/update")
  .patch(
    auth("common"),
    validate(userValidation.updateUser),
    uploadUsers.single("profileImage"),
    cloudinaryUpload("users"),
    userController.updateProfile
  );

router.route("/lists").get(auth("common"), checkAccess("userManagement"), userController.getUsers);

router.route("/public-agent").get(userController.getPublicAgent);


module.exports = router;

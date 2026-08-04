const express = require("express");
const router = express.Router();
const auth = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const { notificationController } = require("../../controllers");
const notificationValidation = require("../../validations/notification.validation");

router.route("/").get(auth("common"), notificationController.getMyNotifications);

router.route("/read-all").patch(auth("common"), notificationController.markAllRead);

router.route("/").delete(auth("common"), notificationController.clearAll);

router
  .route("/:id/read")
  .patch(
    auth("common"),
    validate(notificationValidation.notificationIdParam),
    notificationController.markRead
  );

router
  .route("/:id")
  .delete(
    auth("common"),
    validate(notificationValidation.notificationIdParam),
    notificationController.deleteOne
  );

module.exports = router;

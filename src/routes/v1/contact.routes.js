const express = require("express");
const router = express.Router();
const auth = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const { contactController } = require("../../controllers");
const contactValidation = require("../../validations/contact.validation");

router
  .route("/")
  .post(validate(contactValidation.createContact), contactController.createContact);

router
  .route("/for-property")
  .post(
    auth("common"),
    validate(contactValidation.createPropertyContact),
    contactController.createContact
  );

router.route("/").get(auth("admin"), contactController.getContacts);

router.route("/list").get(auth("adminAndAgent"), contactController.getSelfContacts);

router
  .route("/:contactId")
  .get(auth("adminAndAgent"), contactController.getContact);

module.exports = router;

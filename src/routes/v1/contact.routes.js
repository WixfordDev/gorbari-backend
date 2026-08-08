const express = require("express");
const router = express.Router();
const auth = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const { contactController } = require("../../controllers");
const contactValidation = require("../../validations/contact.validation");
const { contactLimiter } = require("../../middlewares/rateLimiter");

router
  .route("/")
  .post(contactLimiter, validate(contactValidation.createContact), contactController.createContact);

router
  .route("/for-property")
  .post(
    auth("common"),
    validate(contactValidation.createPropertyContact),
    contactController.createContact
  );

router.route("/").get(auth("admin"), contactController.getContacts);

router.route("/list").get(auth("adminAndAgent"), contactController.getSelfContacts);

router.route("/mine").get(auth("common"), contactController.getMyContacts);

router
  .route("/:contactId")
  .get(auth("adminAndAgent"), contactController.getContact);

router
  .route("/:contactId/status")
  .patch(
    auth("adminAndAgent"),
    validate(contactValidation.updateContactStatus),
    contactController.updateContactStatus
  );

// Either side of the conversation can reply - the property owner or the
// original sender - so this only requires being signed in; addReply() itself
// decides which of the two the caller is, and rejects anyone who is neither.
router
  .route("/:contactId/reply")
  .post(
    auth("common"),
    validate(contactValidation.replyToContact),
    contactController.replyToContact
  );

module.exports = router;

const express = require("express");
const auth = require("../../middlewares/auth");
const validate = require("../../middlewares/validate");
const propertyValidation = require("../../validations/property.validation");
const { propertyController } = require("../../controllers");
const userFileUploadMiddleware = require("../../middlewares/fileUpload");
const cloudinaryUpload = require("../../middlewares/cloudinaryUpload");

const uploadProperty = userFileUploadMiddleware();

const router = express.Router();

router
  .route("/create")
  .post(
    auth("common"),
    // multer runs first - only after it parses the multipart body does
    // req.body actually exist for validate() to check. Validating before the
    // (slow, billed) cloudinary upload means a malformed request fails fast.
    uploadProperty.fields([{ name: "images", maxCount: 8 }]),
    validate(propertyValidation.createProperty),
    cloudinaryUpload("propertys"),
    propertyController.createProperty
  );

router.route("/all").get(propertyController.getProperties);

router.route("/selp/all").get(auth("common"), propertyController.getPropertiesForAgent);


router
  .route("/:propertyId/upload-image")
  .post(
    auth("common"),
    validate(propertyValidation.propertyIdParam),
    // Ownership check before multer/cloudinaryUpload, not after: a non-owner
    // is rejected before a real upload happens instead of paying for one
    // that just gets thrown away.
    propertyController.requirePropertyOwnership,
    uploadProperty.single("image"),
    cloudinaryUpload("propertys"),
    propertyController.uploadPropertyImage
  );

router
  .route("/:propertyId/delete-image")
  .delete(auth("common"), validate(propertyValidation.propertyIdParam), propertyController.deletePropertyImage);

router
  .route("/:propertyId")
  .get(propertyController.getPropertyById)
  .patch(
    auth("common"),
    uploadProperty.fields([{ name: "images", maxCount: 8 }]),
    validate(propertyValidation.updateProperty),
    cloudinaryUpload("propertys"),
    propertyController.updateProperty
  )
  .delete(auth("common"), validate(propertyValidation.propertyIdParam), propertyController.deleteProperty);

  router
  .route("/:propertyId/bost")
  .post(
    auth("common"),
    validate(propertyValidation.propertyIdParam),
    propertyController.boostProperty
  );

module.exports = router;

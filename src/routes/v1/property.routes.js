const express = require("express");
const auth = require("../../middlewares/auth");
const { propertyController } = require("../../controllers");
const userFileUploadMiddleware = require("../../middlewares/fileUpload");
const cloudinaryUpload = require("../../middlewares/cloudinaryUpload");

const uploadProperty = userFileUploadMiddleware();

const router = express.Router();

router
  .route("/create")
  .post(
    auth("common"),
    uploadProperty.fields([{ name: "images", maxCount: 8 }]),
    cloudinaryUpload("propertys"),
    propertyController.createProperty
  );

router.route("/all").get(propertyController.getProperties);

router.route("/selp/all").get(auth("common"), propertyController.getPropertiesForAgent);


router
  .route("/:propertyId/upload-image")
  .post(
    auth("common"),
    uploadProperty.single("image"),
    cloudinaryUpload("propertys"),
    propertyController.uploadPropertyImage
  );

router
  .route("/:propertyId/delete-image")
  .delete(auth("common"), propertyController.deletePropertyImage);

router
  .route("/:propertyId")
  .get(propertyController.getPropertyById)
  .patch(
    auth("common"),
    uploadProperty.fields([{ name: "images", maxCount: 8 }]),
    cloudinaryUpload("propertys"),
    propertyController.updateProperty
  )
  .delete(auth("common"), propertyController.deleteProperty);

  router
  .route("/:propertyId/bost")
  .post(
    auth("common"),
    propertyController.boostProperty
  );

module.exports = router;

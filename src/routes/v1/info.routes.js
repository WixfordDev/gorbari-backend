const express = require("express");
const auth = require("../../middlewares/auth");
const { infoController } = require("../../controllers");

const router = express.Router();

// Favorite routes
router
  .route("/favorite")
  .post(auth("common"), infoController.createFavorite)
  .get(auth("common"), infoController.getFavorites)
  .delete(auth("common"), infoController.removeFavorite);

router
  .route("/favorite/:favoriteId")
  .get(auth("common"), infoController.getFavoriteById)
  .patch(auth("common"), infoController.updateFavorite)
  .delete(auth("common"), infoController.deleteFavorite);

router
  .route("/deshbord/status")
  .get(auth("adminAndAgent"), infoController.getAllStatus);

router
  .route("/privacy-policy")
  .post(auth("admin"), infoController.createPrivacy)
  .get(infoController.queryPrivacy);

router
  .route("/terms-services")
  .post(auth("admin"), infoController.createTerms)
  .get(infoController.queryTerms);

router
  .route("/about-us")
  .post(auth("admin"), infoController.createAboutUs)
  .get(infoController.queryAboutUs);

router.route("/public/status").get(infoController.getPublicStatus);

router
  .route("/homepage-settings")
  .post(auth("admin"), infoController.updateHomepageSettings)
  .get(infoController.getHomepageSettings);

module.exports = router;

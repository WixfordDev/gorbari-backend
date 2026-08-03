const express = require("express");
const { getDivisions, getDistricts } = require("../../controllers/location.controller");

const router = express.Router();

// Reference data — public, no auth required.
router.route("/divisions").get(getDivisions);
router.route("/districts").get(getDistricts);

module.exports = router;
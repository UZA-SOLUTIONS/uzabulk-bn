const express = require("express");
const router = express.Router();
const controller = require("./controllers");
const { commonAuthentication } = require("../../middleware");

router.post("/translate-products", commonAuthentication, controller.translateProducts);

module.exports = router;

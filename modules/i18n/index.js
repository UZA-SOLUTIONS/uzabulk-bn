const express = require("express");
const router = express.Router();
const controller = require("./controllers");
const { commonAuthentication } = require("../../middleware");

router.post("/translate-products", commonAuthentication, controller.translateProducts);
router.post("/translate-product-detail", commonAuthentication, controller.translateProductDetail);

module.exports = router;

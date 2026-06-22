const express = require("express");
const router = express.Router();
const controller = require("./controllers");
const { commonAuthentication, exchangeCurrency } = require("../../middleware");

router.get("/homepage-feed", commonAuthentication, exchangeCurrency, controller.homepageFeed);
router.get("/similar-products/:productId", commonAuthentication, exchangeCurrency, controller.similarProducts);
router.get("/cross-sell", commonAuthentication, exchangeCurrency, controller.crossSell);
router.get("/email-digest", commonAuthentication, exchangeCurrency, controller.emailDigest);
router.get("/supplier-highlights", commonAuthentication, exchangeCurrency, controller.supplierHighlights);
router.post("/events", commonAuthentication, controller.trackEngagement);

module.exports = router;

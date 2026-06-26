const express = require("express");
const router = express.Router();
const controller = require("./controllers");
const { commonAuthentication, authentication, exchangeCurrency } = require("../../middleware");

router.get("/homepage-feed", commonAuthentication, exchangeCurrency, controller.homepageFeed);
router.get("/recently-viewed", authentication, exchangeCurrency, controller.recentlyViewed);
router.delete("/recently-viewed", authentication, controller.clearRecentlyViewed);
router.get("/similar-products/:productId", commonAuthentication, exchangeCurrency, controller.similarProducts);
router.get("/cross-sell", commonAuthentication, exchangeCurrency, controller.crossSell);
router.get("/email-digest", commonAuthentication, exchangeCurrency, controller.emailDigest);
router.get("/supplier-highlights", commonAuthentication, exchangeCurrency, controller.supplierHighlights);
router.post("/events", commonAuthentication, controller.trackEngagement);

module.exports = router;

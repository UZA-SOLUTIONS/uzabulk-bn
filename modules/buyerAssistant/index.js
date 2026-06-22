const express = require("express");
const router = express.Router();
const controller = require("./controllers");
const { commonAuthentication } = require("../../middleware");

router.get("/status", controller.status);
router.get("/welcome", commonAuthentication, controller.welcome);
router.post("/chat", commonAuthentication, controller.chat);
router.get("/history", commonAuthentication, controller.history);
router.post("/escalate", commonAuthentication, controller.escalate);

module.exports = router;

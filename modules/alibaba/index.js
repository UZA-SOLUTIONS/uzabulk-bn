const express = require("express");
const router = express.Router();
const oauthController = require("./controllers/oauth");
const { getIntegrationStatus } = require("./services/integrationStatus");

router.get("/status", async (req, res) => {
    try {
        const status = await getIntegrationStatus();
        return res.success("SUCCESS", status);
    } catch (error) {
        console.error(error);
        return res.error(error);
    }
});

router.get("/oauth/authorize-url", oauthController.authorizeUrl);
router.get("/oauth/callback", oauthController.callback);

module.exports = router;

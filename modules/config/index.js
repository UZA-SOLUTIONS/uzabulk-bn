const express = require('express');
const router = express.Router();
const controller = require('./controllers');

router.get('/', controller.getStoreConfigurations);
router.get('/currencies', controller.getCurrencies);
router.get('/integrations', controller.getIntegrations);

module.exports = router;
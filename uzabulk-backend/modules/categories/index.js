const express = require('express');
const router = express.Router();
const controller = require('./controllers');
const { authentication, authorization } = require("../../middleware");

router.get('/list', controller.list);
router.get('/top-cat', controller.topCategories);
router.get('/source-application', controller.sourceByApplicatonCat);
router.get('/listByLevel', controller.listByLevel);

module.exports = router;
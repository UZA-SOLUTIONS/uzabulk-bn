const express = require('express');
const router = express.Router();
const pageController = require('./controllers/page');

router.get('/aboutUs', pageController.getContentByConstant);
router.get('/contactUs', pageController.getContentByConstant);
router.get('/privacyPolicy', pageController.getContentByConstant);
router.get('/termAndConditions', pageController.getContentByConstant);

module.exports = router;
const express = require('express');
const router = express.Router();
const controller = require('./controllers');
const upload = require("../../lib/awsimage-upload");
const { authorization, commonAuthentication, setPagination, exchangeCurrency } = require("../../middleware");
const { productValidate } = require("./middleware");
router.get('/category-thumbnails', commonAuthentication, exchangeCurrency, controller.categoryThumbnails);
router.get('/searchAutocomplete', commonAuthentication, exchangeCurrency, controller.searchAutocomplete);
router.get('/top-ranking', setPagination, exchangeCurrency, controller.topRankingProducts);
router.get('/new-arrivals', setPagination, exchangeCurrency, controller.newArrivalProducts);
router.get('/savings-spotlight', setPagination, exchangeCurrency, controller.getSavingsSpotlight);
router.get('/recommended', commonAuthentication, setPagination, exchangeCurrency, controller.recommended);
router.get('/list', commonAuthentication, setPagination, exchangeCurrency, controller.list);
router.get('/by-offer/:offerId', exchangeCurrency, controller.viewByOfferId);
router.get('/view/:_id', commonAuthentication, productValidate, exchangeCurrency, controller.view);
router.get('/guaranteed-products', setPagination, controller.adminSellerProducts);
router.get('/frequentlySearch', controller.frequentlySearch);
router.post('/ai/smart-listing', commonAuthentication, controller.smartListing);
router.post('/ai/analyze-image', commonAuthentication, controller.analyzeProductImage);
router.post('/ai/image-search-keywords', commonAuthentication, controller.analyzeImageSearchKeywords);
router.post('/ai/image-search', commonAuthentication, upload.uploadLocalFile, setPagination, exchangeCurrency, controller.imageSearchUpload);
router.get('/similar/:productId', commonAuthentication, exchangeCurrency, controller.similarProducts);


module.exports = router;
const express = require('express');
const router = express.Router();
const controller = require('./controllers');
const { authentication, setPagination, commonAuthentication, exchangeCurrency } = require("../../middleware");
const { checkout, placeOrder } = require("./validators")

/**
 * Order APIs
 */

router.post('/checkout', commonAuthentication, exchangeCurrency, checkout, controller.checkout);
router.post('/add', authentication, exchangeCurrency, placeOrder, controller.createOrder);
router.get('/list', authentication, setPagination, controller.list);
router.get('/view/:_id', authentication, controller.view);
router.get('/createSlipUploadLink/:orderId', authentication, controller.createSlipUploadLink);

router.get('/viewOrderDetail', controller.viewOrderDetail);
router.post('/uploadSlip', controller.uploadSlip);



module.exports = router;
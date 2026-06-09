const express = require('express');
const router = express.Router();
const controller = require('./controllers');
const { commonAuthentication, exchangeCurrency } = require("../../middleware");
const { addCart, isIdValid, updateCart } = require("./validators");

/**
 * Carts APIs
 */

router.get('/count', commonAuthentication, controller.count);
router.get('/list', commonAuthentication, exchangeCurrency, controller.list);
router.post('/add', commonAuthentication, addCart, controller.addcartData);
router.put('/update/:_id', commonAuthentication, exchangeCurrency, isIdValid, updateCart, controller.updateCart);
router.delete('/remove/:_id', commonAuthentication, isIdValid, controller.remove);

module.exports = router;
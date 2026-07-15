const express = require('express');
const router = express.Router();
const validator = require('./validators/auth');
const userValidator = require('./validators/user');
const authController = require('./controllers/auth');
const userController = require('./controllers/user');
const { deviceAuthentication, authentication } = require('../../middleware');

router.post('/login', deviceAuthentication, validator.login, authController.login);

router.get('/auth/google', authController.googleAuth);
router.get('/auth/google/callback', authController.googleAuthCallback);
router.get('/auth/google/client-config', authController.googleClientConfig);
router.post('/auth/google/one-tap', deviceAuthentication, authController.googleOneTap);

router.post('/verifyEmail', validator.verifyEmail, authController.verifyEmail);
router.post('/verifyMobileNumber', validator.verifyMobileNumber, authController.verifyMobileNumber);
router.post('/register', deviceAuthentication, validator.register, authController.register);
router.post('/verifyOtp', validator.verifyOtp, authController.verifyOTP);
router.post('/forgotPassword', validator.forgotPassword, authController.forgotPassword);
router.post('/resetPassword', validator.resetPassword, authController.resetPassword);

router.post('/logout', authentication, authController.logout);
router.get('/logout', authentication, authController.logout);

router.get('/profile', authentication, userController.profile);
router.put('/update', authentication, userValidator.updateProfile, userController.updateProfile);
router.put('/changePassword', authentication, userValidator.changePassword, userController.changePassword);

module.exports = router;
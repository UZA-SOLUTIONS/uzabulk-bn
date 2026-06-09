const utils = require("../../../utils/globals");
const {
  stringRequired,
  emailRequired,
  passwordRequired,
  validateRequest,
  confirmPasswordRequired,
  stringRequiredValid,
  stringAllowNull,
} = require("../../../helpers/validationHelper");
const Joi = require("joi");

const login = (req, res, next) => {
  try {
    const isValid = validateRequest(req.body, {
      email: emailRequired,
      password: passwordRequired,
    });

    if (isValid) {
      return next();
    }
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

const verifyEmail = (req, res, next) => {
  try {
    const isValid = validateRequest(req.body, {
      email: emailRequired,
    });

    if (isValid) {
      return next();
    }
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

const verifyMobileNumber = (req, res, next) => {
  try {
    const isValid = validateRequest(req.body, {
      mobileNumber: stringRequired,
      countryCode: stringRequired,
    });

    if (isValid) {
      return next();
    }
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

const register = (req, res, next) => {
  try {
    let isValid = validateRequest(req.body, {
      email: emailRequired,
      password: passwordRequired,
      confirmPassword: confirmPasswordRequired(),
      emailOtp: stringRequired,
      mobileNumber: Joi.string()
        .pattern(/^\d+$/)
        .min(8)
        .max(15)
        .required(),
      countryCode: Joi.string()
        .pattern(/^\+\d+$/)
        .required(),
    });
    if (isValid) {
      return next();
    }
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

const verifyOtp = (req, res, next) => {
  try {
    let isValid = validateRequest(req.body, {
      type: stringRequiredValid("mobile", "email"),
      otp: stringRequired,
      email: Joi.when("type", {
        is: "mobile",
        then: stringAllowNull,
        otherwise: emailRequired,
      }),
      mobileNumber: Joi.when("type", {
        is: "mobile",
        then: stringRequired,
        otherwise: stringAllowNull,
      }),
      countryCode: Joi.when("type", {
        is: "mobile",
        then: stringRequired,
        otherwise: stringAllowNull,
      }),
    });
    if (isValid) {
      return next();
    }
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

const forgotPassword = (req, res, next) => {
  try {
    let isValid = validateRequest(req.body, {
      mobileNumber: stringRequired,
      countryCode: stringRequired,
    });
    if (isValid) {
      return next();
    }
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

const resetPassword = (req, res, next) => {
  try {
    let isValid = validateRequest(req.body, {
      mobileNumber: stringRequired,
      countryCode: stringRequired,
      otp: stringRequired,
      password: passwordRequired,
      confirmPassword: confirmPasswordRequired(),
    });
    if (isValid) {
      return next();
    }
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

module.exports = {
  verifyEmail,
  verifyMobileNumber,
  login,
  register,
  forgotPassword,
  verifyOtp,
  resetPassword,
};

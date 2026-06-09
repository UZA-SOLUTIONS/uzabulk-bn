const Joi = require("joi");
const {
  stringRequired,
  validateRequest,
  stringAllowNull,
  passwordRequired,
  confirmPasswordRequired,
  stringRequiredValid,
  validateWhen,
} = require("../../../helpers/validationHelper");

const updateProfile = (req, res, next) => {
  try {
    let isValid = validateRequest(req.body, {
      type: stringRequiredValid("profile", "mobile", "email"),
      mobileNumber: validateWhen("type", "mobile", stringRequired, stringAllowNull),
      countryCode: validateWhen("type", "mobile", stringRequired, stringAllowNull),
      email: validateWhen("type", "email", stringRequired, stringAllowNull),
      otp: validateWhen("type", "profile", stringAllowNull, stringRequired),
      name: validateWhen("type", "profile", stringRequired, stringAllowNull),
      altMobileNumber: validateWhen("type", "profile", stringRequired, stringAllowNull),
      altCountryCode: validateWhen("type", "profile", stringRequired, stringAllowNull),
      hintName: validateWhen("type", "profile", stringRequired, stringAllowNull),
    });
    if (isValid) {
      return next();
    }
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

const changePassword = (req, res, next) => {
  try {
    let isValid = validateRequest(req.body, {
      currentPassword: stringRequired,
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
  updateProfile,
  changePassword,
};

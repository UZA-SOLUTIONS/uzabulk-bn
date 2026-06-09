const {
  stringRequired,
  validateRequest,
  stringAllowNull,
  numberOptional,
  booleanRequired,
  stringRequiredValid,
  validObjectId,
} = require("../../../helpers/validationHelper");

module.exports = {
  add: (req, res, next) => {
    try {
      let isValid = validateRequest(req.body, {
        area: stringRequired,
        name: stringRequired,
        countryCode: stringRequired,
        mobileNumber: stringRequired,
        houseNo: stringRequired,
        landmark: stringRequired,
        address: stringRequired,
        lattitude: numberOptional,
        longitude: numberOptional,
        addressType: stringRequiredValid("home", "office", "other"),
        default: booleanRequired,
      });
      if (isValid) {
        return next();
      }
    } catch (error) {
      console.error(error);
      res.error(error);
    }
  },
  update: (req, res, next) => {
    try {
      let isValidId = validateRequest(req.params, {
        _id: validObjectId,
      });

      let isValid = validateRequest(req.body, {
        area: stringAllowNull,
        name: stringRequired,
        countryCode: stringRequired,
        mobileNumber: stringRequired,
        houseNo: stringRequired,
        landmark: stringRequired,
        address: stringRequired,
        lattitude: numberOptional,
        longitude: numberOptional,
        addressType: stringRequiredValid("home", "office", "other"),
        default: booleanRequired,
      });
      if (isValid && isValidId) {
        return next();
      }
    } catch (error) {
      console.error(error);
      res.error(error);
    }
  },
  makeDefaultAddress: (req, res, next) => {
    try {
      let isValid = validateRequest(req.params, {
        _id: validObjectId,
      });

      if (isValid) {
        return next();
      }
    } catch (error) {
      console.error(error);
      res.error(error);
    }
  },
  view: (req, res, next) => {
    try {
      let isValidId = validateRequest(req.params, {
        _id: validObjectId,
      });
      if (isValidId) {
        return next();
      }
    } catch (error) {
      console.error(error);
      res.error(error);
    }
  },
  delete: (req, res, next) => {
    try {
      let isValidId = validateRequest(req.params, {
        _id: validObjectId,
      });
      if (isValidId) {
        return next();
      }
    } catch (error) {
      console.error(error);
      res.error(error);
    }
  },
};

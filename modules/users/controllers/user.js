"use strict";
const utils = require("../../../utils");
const UserServices = require("../services");

exports.profile = async (req, res) => {
  try {
    const user = await UserServices.findOneWithProfileImage({ _id: req.user._id });
    if (!user) return res.error("USER_NOT_FOUND");
    return res.success("RECORD_FOUND", user);
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

exports.updateProfile = async (req, res) => {
  try {
    let { type, otp, countryCode, mobileNumber, email, name, altMobileNumber, altCountryCode, hintName } = req.body;

    if(type === "profile") {
      const setData = { name };
      if (altMobileNumber && altCountryCode) {
        setData.altCountryCode = altCountryCode;
        setData.altMobileNumber = altMobileNumber;
      }
      if (hintName) {
        setData.hintName = hintName;
      }
  
      let user = await UserServices.update({ _id: req.user._id }, setData);
  
      return res.success("PROFILE_UPDATED_SUCCESS", user);
    }
    else if(type === "mobile") {

      await UserServices.mobileOtp(mobileNumber, countryCode, otp);

      let user = await UserServices.update({ _id: req.user._id }, { mobileNumber, countryCode });

      return res.success("MOBILE_NUMBER_UPDATED", user);
    }
    else if(type === "email") {
      await UserServices.emailOtp(email, otp);

      let user = await UserServices.update({ _id: req.user._id }, { email });

      return res.success("EMAIL_UPDATED", user);
    }

    return res.error("SOMETHING_WENT_WRONG");
    
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

exports.changePassword = async (req, res) => {
  try {
    let { currentPassword, password, confirmPassword } = req.body;

    const isValid = await utils.verifyPassword(
      req.user.password,
      currentPassword
    );

    if (!isValid) return res.error("INVALID_CURRENT_PASSWORD");

    if (currentPassword === password) return res.error("CHOOSE_DIFF_PASSWORD");

    await UserServices.update(
      { _id: req.user._id },
      { password: await utils.hashPassword(password) }
    );

    return res.success("PASSWORD_UPDATED");
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

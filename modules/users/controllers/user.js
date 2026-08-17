"use strict";
const utils = require("../../../utils");
const UserServices = require("../services");
const { sanitizeUserForClient } = require("../services/googleAuthService");

exports.profile = async (req, res) => {
  try {
    const user = await UserServices.findOneWithProfileImage({ _id: req.user._id });
    if (!user) return res.error("USER_NOT_FOUND");
    const plain = sanitizeUserForClient(user);
    // Ensure Google avatar from a prior Google login is always returned for UI.
    if (!plain.google_picture && user.google_picture) {
      plain.google_picture = user.google_picture;
    }
    return res.success("RECORD_FOUND", plain);
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
  
      return res.success("PROFILE_UPDATED_SUCCESS", sanitizeUserForClient(user));
    }
    else if(type === "mobile") {
      const sameNumber =
        String(req.user?.mobileNumber || "") === String(mobileNumber || "")
        && String(req.user?.countryCode || "") === String(countryCode || "");

      if (!sameNumber) {
        const taken = await UserServices.mobileNumberExist(
          mobileNumber,
          countryCode,
          { excludeUserId: req.user._id }
        );
        if (taken) return res.error("MOBILE_NUMBER_ALREADY_EXIST");
        await UserServices.mobileOtp(mobileNumber, countryCode, otp);
      }

      let user = await UserServices.update({ _id: req.user._id }, { mobileNumber, countryCode });

      return res.success("MOBILE_NUMBER_UPDATED", sanitizeUserForClient(user));
    }
    else if(type === "email") {
      await UserServices.emailOtp(email, otp);

      let user = await UserServices.update({ _id: req.user._id }, { email });

      return res.success("EMAIL_UPDATED", sanitizeUserForClient(user));
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

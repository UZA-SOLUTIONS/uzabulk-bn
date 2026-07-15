"use strict";
const utils = require("../../../utils");
const UserServices = require("../services");
const SessionServices = require("../services/session");
const TemplateServices = require("../services/templates");
const { sendEmail } = require("../../../lib/ses");

/** Plain user for JSON + frontend Redux (no password / secrets). */
const sanitizeUserForClient = (user) => {
  if (!user) return null;
  const plain =
    typeof user.toObject === "function"
      ? user.toObject({ virtuals: false })
      : { ...user };
  delete plain.password;
  delete plain.salt;
  delete plain.OTP;
  delete plain.OTPexp;
  delete plain.restToken;
  delete plain.tokens;
  return plain;
};

/**
 * The customer will have to ﬁll following details
 * Note: Customers can also log in through social media- Facebook and Google
 * mobileNumber, countryCode, password, gId, fId
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.login = async (req, res) => {
  try {
    const { user, token } = await UserServices.login(req.body);

    try {
      await UserServices.mergeCart(user._id, req.deviceId);
    } catch (mergeErr) {
      console.warn("mergeCart failed (login still succeeds):", mergeErr?.message || mergeErr);
    }

    await SessionServices.saveToken(user._id, token);

    return res.success("LOGIN_SUCCESS", { user: sanitizeUserForClient(user), token });
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    let data = req.body;
    data.email = data.email.trim().toLowerCase();

    let userExist = await UserServices.emailExist(data.email);

    if (userExist) return res.error("EMAIL_ALREADY_EXIST");

    const otp = await UserServices.createOtp({ email: data.email });

    const template = await TemplateServices.getEmailTemplate(
      "CUSTOMER_OTP"
    );
    if (template) {
      template.body = template.body.replaceAll("[OTP]", otp);
      template.body = template.body.replaceAll("[email]", data.email);
      await sendEmail(data.email, template.subject, template.body);
    } else {
      await sendEmail(
        data.email,
        "UZA Bulk - Email verification code",
        "Your one time password is " + otp
      );
    }

    return res.success("OTP_SENT_TO_YOUR_EMAIL");
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

exports.verifyMobileNumber = async (req, res) => {
  try {
    let data = req.body;
    data.mobileNumber = data.mobileNumber.trim();

    let userExist = await UserServices.mobileNumberExist(
      data.mobileNumber,
      data.countryCode
    );

    if (userExist) return res.error("MOBILE_NUMBER_ALREADY_EXIST");

    await UserServices.createOtp({
      mobileNumber: data.mobileNumber,
      countryCode: data.countryCode,
    });

    return res.success("OTP_SENT_TO_YOUR_MOBILE_NUMBER");
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

/**
 * Customer signup: email + email OTP, password, phone (no mobile OTP on signup).
 */
exports.register = async (req, res) => {
  try {
    let data = req.body;
    data.email = data.email.trim().toLowerCase();
    let emailExist = await UserServices.emailExist(data.email);
    if (emailExist) return res.error("EMAIL_ALREADY_EXIST");

    if (data.mobileNumber && data.countryCode) {
      let mobileExist = await UserServices.mobileNumberExist(
        data.mobileNumber,
        data.countryCode
      );
      if (mobileExist) return res.error("MOBILE_NUMBER_ALREADY_EXIST");
    }

    // Verify email OTP only (mobile OTP optional for signup).
    await UserServices.emailOtp(data.email, data.emailOtp);

    data.password = await utils.hashPassword(data.password);
    data.status = "active";
    const { date, utcDate } = utils.getDate();
    data.date_created_utc = utcDate;
    data.date_created = date;

    const user = await UserServices.create(data);

    try {
      await UserServices.mergeCart(user._id, req.deviceId);
    } catch (mergeErr) {
      console.warn("mergeCart failed (register still succeeds):", mergeErr?.message || mergeErr);
    }

    const token = utils.generateToken(user);

    await SessionServices.saveToken(user._id, token);

    return res.success("REGISTER_SUCCESS", { user: sanitizeUserForClient(user), token });
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    let { type, otp, email, mobileNumber, countryCode } = req.body;

    if (type === "mobile") {
      await UserServices.mobileOtp(mobileNumber, countryCode, otp, false);

      return res.success("CODE_VERIFIED_SUCCESSS");
    } else {
      await UserServices.emailOtp(email, otp, false);

      return res.success("CODE_VERIFIED_SUCCESSS");
    }
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

/**
 * Customers will have the option to reset the account password by clicking on this forgot password button.
 * An OTP will be shared on the registered mobile number for resetting the current password.
 * @param {*} req
 * @param {*} res
 * @returns
 */
exports.forgotPassword = async (req, res) => {
  try {
    let { countryCode, mobileNumber } = req.body;

    let user = await UserServices.findByMobileNumber(mobileNumber, countryCode, [
      "archived",
    ]);
    if (!user) return res.error("USER_NOT_FOUND");
    if (user.status === "blocked") throw new Error("ACCOUNT_BLOCKED");

    const otp = await UserServices.createOtp({ mobileNumber, countryCode });

    return res.success("OTP_SENT_TO_MOBILE_NUMBER");
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

exports.resetPassword = async (req, res) => {
  try {
    let data = req.body;

    let user = await UserServices.findByMobileNumber(data.mobileNumber, data.countryCode);
    if (!user) return res.error("USER_NOT_FOUND");
    if (user.status === "blocked") throw new Error("ACCOUNT_BLOCKED");

    if (data.password !== data.confirmPassword)
      return res.error("PASSWORD_MISMATCH");

    if (user.password) {
      const isValid = await utils.verifyPassword(user.password, data.password);
      if (isValid) return res.error("USING_OLD_PASSWORD");
    }

    await UserServices.mobileOtp(data.mobileNumber, data.countryCode, data.otp);

    user.password = await utils.hashPassword(data.password);
    await user.save();

    return res.success("RESET_PASSWORD_SUCCESS");
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

exports.logout = async (req, res) => {
  try {
    await SessionServices.logout(req.user._id, req.token);

    return res.success("LOGOUT_SUCCESS");
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

const {
  configurePassportGoogle,
  isGoogleAuthConfigured,
  passport,
} = require("../services/googlePassport");
const {
  findOrCreateGoogleUser,
  verifyGoogleCredential,
} = require("../services/googleAuthService");

const getFrontendBaseUrl = () =>
  String(
    process.env.FRONTEND_URL
    || process.env.CLIENT_URL
    || env.CLIENT_URL
    || "http://localhost:3000"
  ).replace(/\/+$/, "");

const redirectGoogleResult = (res, { token, error }) => {
  const base = getFrontendBaseUrl();
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (error) params.set("error", error);
  return res.redirect(`${base}/auth/google/callback?${params.toString()}`);
};

/**
 * Public config for Google One Tap / GIS (client id only — safe to expose).
 */
exports.googleClientConfig = async (req, res) => {
  try {
    const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
    return res.success("RECORD_FOUND", {
      clientId: clientId || null,
      oneTapEnabled: Boolean(clientId),
    });
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

/**
 * Google One Tap / GIS credential login — no redirect, no login modal.
 */
exports.googleOneTap = async (req, res) => {
  try {
    const credential = String(req.body?.credential || "").trim();
    if (!credential) {
      return res.error("GOOGLE_CREDENTIAL_REQUIRED");
    }

    const profile = await verifyGoogleCredential(credential);
    const { user, token } = await findOrCreateGoogleUser(profile);

    const deviceId = String(
      req.body?.deviceId || req.deviceId || req.headers?.deviceid || ""
    ).trim();
    if (deviceId && user?._id) {
      try {
        await UserServices.mergeCart(user._id, deviceId);
      } catch (mergeErr) {
        console.warn("mergeCart failed (google one-tap still succeeds):", mergeErr?.message || mergeErr);
      }
    }

    return res.success("LOGIN_SUCCESS", { user, token });
  } catch (error) {
    console.error("[google-one-tap]", error);
    const code = error?.message || "GOOGLE_AUTH_FAILED";
    return res.error(code);
  }
};

/**
 * Start Google OAuth. Optional ?deviceId= for cart merge after login.
 */
exports.googleAuth = (req, res, next) => {
  if (!isGoogleAuthConfigured()) {
    return redirectGoogleResult(res, { error: "GOOGLE_AUTH_NOT_CONFIGURED" });
  }
  configurePassportGoogle();
  const deviceId = String(req.query.deviceId || req.headers.deviceid || "").trim();
  return passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    state: deviceId || undefined,
    prompt: "select_account",
  })(req, res, next);
};

/**
 * Google OAuth callback — merge/create user, issue JWT, redirect to frontend.
 */
exports.googleAuthCallback = (req, res, next) => {
  if (!isGoogleAuthConfigured()) {
    return redirectGoogleResult(res, { error: "GOOGLE_AUTH_NOT_CONFIGURED" });
  }
  configurePassportGoogle();

  passport.authenticate("google", { session: false }, async (err, payload) => {
    try {
      if (err || !payload?.profile) {
        console.error("[google-auth] callback failed:", err?.message || err || "no profile");
        return redirectGoogleResult(res, { error: "GOOGLE_AUTH_FAILED" });
      }

      const { user, token } = await findOrCreateGoogleUser(payload.profile);

      const deviceId = String(payload.deviceId || "").trim();
      if (deviceId && user?._id) {
        try {
          await UserServices.mergeCart(user._id, deviceId);
        } catch (mergeErr) {
          console.warn("mergeCart failed (google login still succeeds):", mergeErr?.message || mergeErr);
        }
      }

      return redirectGoogleResult(res, { token });
    } catch (error) {
      console.error("[google-auth]", error);
      const code = error?.message || "GOOGLE_AUTH_FAILED";
      return redirectGoogleResult(res, { error: code });
    }
  })(req, res, next);
};

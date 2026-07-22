const { OAuth2Client } = require("google-auth-library");
const utils = require("../../../utils");
const UserServices = require("./index");
const SessionServices = require("./session");

const AUTH_ROLES = [env.ROLE, env.RETAILER_ROLE].filter(Boolean);

/**
 * Verify a Google Identity Services ID token (One Tap / GIS button)
 * and map it to the Passport-like profile shape used by findOrCreateGoogleUser.
 */
const verifyGoogleCredential = async (credential) => {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  if (!clientId) throw new Error("GOOGLE_AUTH_NOT_CONFIGURED");

  const idToken = String(credential || "").trim();
  if (!idToken) throw new Error("GOOGLE_CREDENTIAL_REQUIRED");

  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });
  const payload = ticket.getPayload() || {};

  if (!payload.sub) throw new Error("GOOGLE_PROFILE_INVALID");
  if (!payload.email) throw new Error("GOOGLE_EMAIL_REQUIRED");
  if (payload.email_verified === false) throw new Error("GOOGLE_EMAIL_REQUIRED");

  return {
    id: payload.sub,
    emails: [{ value: payload.email }],
    name: {
      givenName: payload.given_name || "",
      familyName: payload.family_name || "",
    },
    displayName: payload.name || "",
    photos: payload.picture ? [{ value: payload.picture }] : [],
    _json: payload,
  };
};

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

const pickGoogleProfile = (profile = {}) => {
  const email = String(
    profile.emails?.[0]?.value
    || profile._json?.email
    || ""
  ).trim().toLowerCase();

  const firstName = String(
    profile.name?.givenName
    || profile._json?.given_name
    || ""
  ).trim();
  const lastName = String(
    profile.name?.familyName
    || profile._json?.family_name
    || ""
  ).trim();
  const displayName = String(profile.displayName || `${firstName} ${lastName}`.trim()).trim();
  const picture = String(
    profile.photos?.[0]?.value
    || profile._json?.picture
    || ""
  ).trim();

  // Persist a high-res Google photo URL (default GIS thumbnails are ~96px).
  let hdPicture = picture;
  if (hdPicture && /googleusercontent\.com/i.test(hdPicture)) {
    if (/=s\d+-c\b/i.test(hdPicture)) {
      hdPicture = hdPicture.replace(/=s\d+-c\b/i, "=s512-c");
    } else if (/=s\d+\b/i.test(hdPicture)) {
      hdPicture = hdPicture.replace(/=s\d+\b/i, "=s512");
    } else if (/[?&]sz=\d+/i.test(hdPicture)) {
      hdPicture = hdPicture.replace(/([?&]sz=)\d+/i, "$1512");
    } else {
      hdPicture += (hdPicture.includes("?") ? "&" : "?") + "sz=512";
    }
  }

  return {
    googleId: String(profile.id || "").trim(),
    email,
    firstName,
    lastName,
    name: displayName || email.split("@")[0] || "Google User",
    picture: hdPicture,
  };
};

/**
 * Find by google_id, else merge into existing email account, else create.
 */
const findOrCreateGoogleUser = async (profile) => {
  const data = pickGoogleProfile(profile);
  if (!data.googleId) throw new Error("GOOGLE_PROFILE_INVALID");
  if (!data.email) throw new Error("GOOGLE_EMAIL_REQUIRED");

  let user = await UserServices.findOne({
    google_id: data.googleId,
    status: { $ne: "archived" },
  });

  if (!user) {
    user = await UserServices.findByEmail(data.email, ["archived"], null, {
      role: { $in: AUTH_ROLES },
    });
    if (!user) {
      user = await UserServices.findByEmail(data.email);
    }
  }

  const { date, utcDate } = utils.getDate();

  if (user) {
    if (user.status === "blocked") throw new Error("ACCOUNT_BLOCKED");

    // Merge Google identity into the existing email account.
    user.google_id = data.googleId;
    user.isLoginFromSocial = true;
    if (!user.email) user.email = data.email;
    if (!user.firstName && data.firstName) user.firstName = data.firstName;
    if (!user.lastName && data.lastName) user.lastName = data.lastName;
    if (!user.name && data.name) user.name = data.name;
    if (data.picture) user.google_picture = data.picture;
    if (!user.role) user.role = env.ROLE;
    if (user.status === "created" || user.status === "temp") user.status = "active";
    user.date_modified = date;
    user.date_modified_utc = utcDate;
    await user.save();
  } else {
    user = await UserServices.create({
      email: data.email,
      google_id: data.googleId,
      google_picture: data.picture || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      name: data.name,
      isLoginFromSocial: true,
      isSignupDetailCompleted: true,
      status: "active",
      role: env.ROLE,
      date_created: date,
      date_created_utc: utcDate,
    });
  }

  await user.populate("profileImage");
  const token = utils.generateToken(user);
  await SessionServices.saveToken(user._id, token);

  return {
    user: sanitizeUserForClient(user),
    token,
  };
};

module.exports = {
  pickGoogleProfile,
  findOrCreateGoogleUser,
  sanitizeUserForClient,
  verifyGoogleCredential,
};

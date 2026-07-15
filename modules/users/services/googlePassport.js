const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const getGoogleConfig = () => ({
  clientID: String(process.env.GOOGLE_CLIENT_ID || "").trim(),
  clientSecret: String(process.env.GOOGLE_CLIENT_SECRET || "").trim(),
  callbackURL: String(
    process.env.GOOGLE_REDIRECT_URI
    || `http://localhost:${process.env.PORT || 1302}/api/v1/users/auth/google/callback`
  ).trim(),
});

const isGoogleAuthConfigured = () => {
  const { clientID, clientSecret, callbackURL } = getGoogleConfig();
  return Boolean(clientID && clientSecret && callbackURL);
};

let strategyRegistered = false;

const configurePassportGoogle = () => {
  if (strategyRegistered) return passport;
  if (!isGoogleAuthConfigured()) {
    console.warn("[google-auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI not set");
    return passport;
  }

  const { clientID, clientSecret, callbackURL } = getGoogleConfig();

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          done(null, {
            profile,
            accessToken,
            deviceId: req.query?.state || req.session?.oauthDeviceId || null,
          });
        } catch (error) {
          done(error);
        }
      }
    )
  );

  // Stateless OAuth — we issue our own JWT after callback.
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));

  strategyRegistered = true;
  return passport;
};

module.exports = {
  passport,
  configurePassportGoogle,
  isGoogleAuthConfigured,
  getGoogleConfig,
};

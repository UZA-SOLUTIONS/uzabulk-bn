// logging permission
const levels = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4
};

const loggingPermissions = {
  loggingEnabled: true,
  globalLoggingLevel: levels.info,
  defaultLoggingLevel: levels.trace,

  users: {
    loggingEnabled: true,
    defaultLoggingLevel: levels.trace,
    userSignup: true,
  },

  server: {
    loggingEnabled: true,
    defaultLoggingLevel: levels.trace
  }
};

module.exports = loggingPermissions;
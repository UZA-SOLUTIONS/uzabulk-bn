const winstonLogger = require('./winston');
const logPermission = require('./loggingPermission');
const globalFunctions = require('../utils');

const levels = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4
};

// A variadic function to log the stuff
const log = (loggingLevel, loggingParameters) => {
  let handlingInfo = loggingParameters[0];
  let apiModule = handlingInfo.apiModule;
  let apiHandler = handlingInfo.apiHandler;

  // winston logging
  winstonLogger.log(loggingLevel, loggingParameters);

  //rest of the logging
  if (loggingLevel !== levels.error && loggingLevel < logPermission.globalLoggingLevel && (!isLoggingEnabled(apiModule, apiHandler))) {
    return;
  }

  let stream = process.stdout;
  if (loggingLevel === levels.error) {
    stream = process.stderr;
  }
  let requestId = handlingInfo.uuid ? ' - ' + handlingInfo.uuid : '';
  let loggingTime = '[ ' + globalFunctions.getLoggingTime() + requestId + ' ] ';
  for (let i = 1; i < loggingParameters.length; i++) {
    stream.write(loggingTime + apiModule + ' ::: ' + apiHandler + ' ::: ' + JSON.stringify(loggingParameters[i]) + '\n');
  }
}

function trace(/* arguments */) {
  log(levels.trace, arguments);
}

function debug(/* arguments */) {
  log(levels.debug, arguments);
}

function info(/* arguments */) {
  log(levels.info, arguments);
}

function warn(/* arguments */) {
  log(levels.warn, arguments);
}

function error(/* arguments */) {
  log(levels.error, arguments);
}

function isLoggingEnabled(module, handler) {
  // Check if the logging has been enabled
  if (!logPermission.loggingEnabled) {
    return false;
  }

  // Check if the logging has been enabled for the complete module
  if (!logPermission[module].loggingEnabled) {
    return false;
  }

  // Check if the logging has been enabled for the particular handler function for the module
  if (!logPermission[module][handler]) {
    return false;
  }

  return true;
}

module.exports = {
  info,
  error,
  warn,
  trace,
  debug
}
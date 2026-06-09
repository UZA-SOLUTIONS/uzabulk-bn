
let winston = require('winston');
let winstonRotate = require('winston-daily-rotate-file');
let path = require('path');
const globalFunctions = require('../utils');

const levelToWinstonLevel = {
  0: 'verbose',
  1: 'debug',
  2: 'info',
  3: 'warn',
  4: 'error',
};

let Logger = {};

Logger.options = {
  name: 'logs',
  filename: path.join(__dirname, '..', 'logs/api.log'),
  datePattern: '.dd-MM-yyyy',
  maxDays: 14,
  zippedArchive: true
};

Logger.winstonRotateObj = new winstonRotate(Logger.options);
Logger.transports = [Logger.winstonRotateObj];
Logger.winstonLogger = new winston.Logger({ level: 'debug', transports: Logger.transports });


function log(loggingLevel, loggingParameters) {
  let winstonLogger = Logger.winstonLogger;

  let handlingInfo = loggingParameters[0];
  let apiModule = handlingInfo.apiModule;
  let apiHandler = handlingInfo.apiHandler;


  let requestId = handlingInfo.uuid ? ' - ' + handlingInfo.uuid + ' ' : '';
  let loggingTime = '[ ' + globalFunctions.getLoggingTime() + requestId + ' ] ';
  // for (let i = 1; i < loggingParameters.length; i++) {
  //   winstonLogger.log(levelToWinstonLevel[loggingLevel], loggingTime + apiModule + ' ::: ' + apiHandler + ' ::: ' + JSON.stringify(loggingParameters[i]) + '\n');
  // }
}

exports.log = log;
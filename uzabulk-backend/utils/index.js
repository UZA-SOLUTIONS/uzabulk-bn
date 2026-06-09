const moment = require('moment-timezone');
const _ = require('lodash');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
let sendSuccessResponse = (message, res, data, options = {}) => {
    var resData = {
        status: "success",
        status_code: 200,
        message: __(message),
        data: data ? data : {},
        ...options,
    };
    return res.status(200).send(resData);
};

let sendErrorResponse = function (err, res, data) {
    let code = 400;
    if (typeof err === 'object' && err !== null) {
        const httpStatus = Number(err.statusCode || err.status);
        if (httpStatus >= 100 && httpStatus < 600) {
            code = httpStatus;
        }
    }
    let message = (typeof err === 'object') ? (err.message ? err.message : 'Internal Server Error') : err;
    var resData = {
        status: "failure",
        status_code: code,
        message: __(message),
        data: data ? data : {},
    };

    return res.status(code).send(resData);
};
let getCurrentDateAndTimeInCityTimezoneFromUTC = (cityTimezone) => {
    let a = moment.tz(new Date(), cityTimezone)
    return a;
};

let getDateAndTimeInCityTimezone = (date, cityTimezone) => {
    let a = moment.tz(date, cityTimezone)
    return a;
};

let roundNumber = (num) => {
    return Math.round(num * 100) / 100;
}

let generateOTP = (codelength) => {
    return Math.floor(Math.random() * (Math.pow(10, (codelength - 1)) * 9)) + Math.pow(10, (codelength - 1));
};

let generatorRandomNumber = (length) => {
    if (typeof length == "undefined")
        length = 2;
    var token = "";
    var possible = "123456789";
    for (var i = 0; i < length; i++)
        token += possible.charAt(Math.floor(Math.random() * possible.length));
    return token;
};

let getScheduleData = (format, sd, st, pickupTimezone) => {
    let dateStructure = sd + " " + st;
    let ar = helper.getDateAndTimeInCityTimezone(dateStructure, pickupTimezone);
    let scheduledTime = ar.format('LT'); //08:30 PM
    let scheduledDate = ar.format('L'); //04/09/1986
    let scheduled_utcs = new Date(ar.utc().format());

    return { scheduledDate: scheduledDate, scheduledTime: scheduledTime, scheduled_utc: scheduled_utcs, currentUTC: new Date() };
};

let isValidDate = (date, format) => {
    var validDateFormat = moment(date, format).isValid();

    return validDateFormat;
};
let extendDate = (date = new Date(), time, action = "minutes") => {
    return moment(date).add(action, action);
};
let compareDates = (date1, date2 = new Date()) => {
    date1 = new Date(date1).getTime();
    date2 = new Date(date2).getTime();
    return date1 > date2;
};
let calculateDayRange = (date = new Date()) => {
    const startOfDay = moment(date).startOf('day');
    const endOfDay = moment(date).endOf('day');
    return {
        startOfDay,
        endOfDay,
    };
}


// "DD-MM HH:mm:ss.SSS"
const getLoggingTime = () => {
    let date = new Date();
    return pad(date.getUTCMonth() + 1)
        + '-' + pad(date.getUTCDate())
        + ' ' + pad(date.getUTCHours())
        + ':' + pad(date.getUTCMinutes())
        + ':' + pad(date.getUTCSeconds())
        + '.' + String((date.getUTCMilliseconds() / 1000).toFixed(3)).slice(2, 5);
}

const pad = (number) => {
    var r = String(number);
    if (r.length === 1) {
        r = '0' + r;
    }
    return r;
}

const hashPassword = async (password) => {
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
};
const verifyPassword = async (hashedPassword, password) => {
    const validPassword = await bcrypt.compare(password, hashedPassword);
    return validPassword;
};

const generateToken = (user, expiresIn = '15d') => {
    console.log("tokenExpiresIn:", expiresIn)
    return jwt.sign(
        {
            _id: user._id,
            email: user.email,
            name: user.name
        },
        env.jwtSecret,
        { expiresIn: expiresIn }
    );
};
const verifyToken = (token) => {
    return jwt.verify(
        token,
        env.jwtSecret
    );
};

const generateHashKey = (length = 30, start_with = "tok") => {
    return start_with + crypto.randomBytes(length).toString('hex');
};
const { attachProductMoqFields } = require('../modules/products/helper/moq');
const { attachProductSupplierFields } = require('../modules/products/helper/supplier');

const processVariations = (item) => {
    if (item?.type === 'variable' && Array.isArray(item.variations)) {
        _.forEach(item.variations, element => {
            let variation_id = _.map(element.attributes, attribute => attribute._id.toString());
            let variation_title = _.map(element.attributes, attribute => attribute.name.toString());
            element.variation_id = variation_id.join('~');
            element.variation_title = variation_title.join('/');
        });
    }
    return attachProductSupplierFields(attachProductMoqFields(item));
}
const createToken = (data, expiresIn = '15d') => {
    return jwt.sign(
        data,
        env.jwtSecret,
        { expiresIn: expiresIn }
    );
};
const getDate = () => {
    const now = new Date();
    return { date: now, utcDate: new Date(now.toUTCString()) };
}
const paymentSlipUploadLink = (userId, orders) => {
    return env.CLIENT_URL + "/upload-slip?data=" + createToken({
        orderIds: orders?.map((order) => order._id),
        userId,
    })
}

module.exports = {
    sendErrorResponse,
    sendSuccessResponse,
    getCurrentDateAndTimeInCityTimezoneFromUTC,
    getDateAndTimeInCityTimezone,
    roundNumber,
    generateOTP,
    generatorRandomNumber,
    getScheduleData,
    isValidDate,
    getLoggingTime,
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    compareDates,
    extendDate,
    generateHashKey,
    calculateDayRange,
    processVariations,
    getDate,
    paymentSlipUploadLink
}

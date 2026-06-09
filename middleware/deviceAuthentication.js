const { verifyToken } = require("../utils");
const UserServices = require('../modules/users/services');
const SessionServices = require('../modules/users/services/session');

const deviceAuthenticate = async (req, res, next) => {
    req.deviceId = req.headers?.deviceid;
    req.isLogin = false;
    if (!req.deviceId)
        return res.error({
            message: 'REQUIRED_DEVICE_ID',
            code: 401
        });

    next();
};


module.exports = deviceAuthenticate;
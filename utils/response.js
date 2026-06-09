const { sendSuccessResponse, sendErrorResponse } = require("./index");
function wrapResponse(req, res) {
    res.success = function (msg, options = {}, others = {}) {
        let message = "DATA_SUCCESS";
        if (typeof msg !== 'string') {
            return sendSuccessResponse(message, res, msg, options);
        } else {
            return sendSuccessResponse(msg, res, options, others);
        }
    }

    res.error = function (msg, options = {}) {

        return sendErrorResponse(msg, res, options);
    }
    return res;
}

module.exports = wrapResponse;

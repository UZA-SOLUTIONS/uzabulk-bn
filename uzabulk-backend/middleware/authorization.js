let Store = require("../models/storeTable");
async function authorization(req, res, next) {
    const api_key = req.get('apikey');
    if (!api_key) {
        return res.error({
            message: 'API_KEY_IS_REQUIRED',
            code: 401,
        });
    }
    const getApp = await Store.findOne({ api_key: api_key, status: "active" })
        .exec();

    if (getApp == null) {
        return res.error({
            message: 'API_KEY_IS_INVALID',
            code: 401,
        });
    }

    req.settings = {
        paymentMode: getApp.paymentMode,
        paymentSettings: getApp.paymentSettings,
        currency: getApp.currency,
        timezone: getApp.timezone,
        language: getApp.language,
        storeLanguage: getApp.storeLanguage,
        firebase: getApp.firebase,
    }

    next();
}

module.exports = authorization;
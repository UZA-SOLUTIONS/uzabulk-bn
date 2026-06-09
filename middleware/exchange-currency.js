const mongoose = require("mongoose");
const { defaultExchangeRate } = require("../config/db/constants");

module.exports = async (req, res, next) => {
    try {
        const currencyCode = req.get('Accept-Currency') || defaultExchangeRate.symbol;
        const CurrencyExchangeRate = global._model?.CurrencyExchangeRate;

        if (!CurrencyExchangeRate || mongoose.connection.readyState !== 1) {
            req.exchangeRate = defaultExchangeRate;
            return next();
        }

        const exchangeRate = await CurrencyExchangeRate.findOne({ code: currencyCode }).exec();
        req.exchangeRate = exchangeRate || defaultExchangeRate;
    } catch (error) {
        console.log("Exchange middleware error", error.message);
        req.exchangeRate = defaultExchangeRate;
    }
    next();
};
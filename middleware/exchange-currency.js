const mongoose = require("mongoose");
const { defaultExchangeRate } = require("../config/db/constants");
const { isMongoConnected } = require("../config/db");

const CACHE_TTL_MS = Math.min(
    Math.max(Number(process.env.EXCHANGE_RATE_CACHE_TTL_MS || 120000), 30000),
    600000
);

const rateCache = new Map();

const cacheKey = (code = "") => String(code || "").trim().toUpperCase() || defaultExchangeRate.symbol;

const readCache = (code) => {
    const entry = rateCache.get(cacheKey(code));
    if (!entry || entry.expiresAt <= Date.now()) {
        if (entry) rateCache.delete(cacheKey(code));
        return null;
    }
    return entry.value;
};

const writeCache = (code, value) => {
    rateCache.set(cacheKey(code), {
        value,
        expiresAt: Date.now() + CACHE_TTL_MS,
    });
    while (rateCache.size > 24) {
        const oldestKey = rateCache.keys().next().value;
        rateCache.delete(oldestKey);
    }
};

module.exports = async (req, res, next) => {
    try {
        const currencyCode = req.get('Accept-Currency') || defaultExchangeRate.symbol;
        const cached = readCache(currencyCode);
        if (cached) {
            req.exchangeRate = cached;
            return next();
        }

        const CurrencyExchangeRate = global._model?.CurrencyExchangeRate;

        if (!CurrencyExchangeRate || !isMongoConnected()) {
            req.exchangeRate = defaultExchangeRate;
            writeCache(currencyCode, defaultExchangeRate);
            return next();
        }

        const exchangeRate = await CurrencyExchangeRate.findOne({ code: currencyCode }).exec();
        req.exchangeRate = exchangeRate || defaultExchangeRate;
        writeCache(currencyCode, req.exchangeRate);
    } catch (error) {
        console.log("Exchange middleware error", error.message);
        req.exchangeRate = defaultExchangeRate;
        writeCache(req.get('Accept-Currency') || defaultExchangeRate.symbol, defaultExchangeRate);
    }
    next();
};

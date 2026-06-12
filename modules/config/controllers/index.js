"use strict";

const mongoose = require("mongoose");
const { defaultExchangeRate } = require("../../../config/db/constants");
const { getIntegrationStatus } = require("../../alibaba/services/integrationStatus");

exports.getStoreConfigurations = async (req, res) => {
  try {
    const data = await _model.StoreType.findOne(null, "commission");
    return res.success("SUCCESS", data);
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

// Get currencies for exchange rate.
exports.getCurrencies = async (req, res) => {
  try {
    const CurrencyExchangeRate = global._model?.CurrencyExchangeRate;
    let data = [];

    if (CurrencyExchangeRate && mongoose.connection.readyState === 1) {
      data = await CurrencyExchangeRate.find({ status: "active" }, "-exchangeRate").lean();
    }

    if (!data?.length) {
      data = [defaultExchangeRate];
    }

    return res.success("SUCCESS", data);
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};

exports.getIntegrations = async (req, res) => {
  try {
    const status = await getIntegrationStatus();
    return res.success("SUCCESS", status);
  } catch (error) {
    console.error(error);
    res.error(error);
  }
};
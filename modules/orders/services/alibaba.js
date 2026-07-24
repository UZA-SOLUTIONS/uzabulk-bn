const client = require("../../../lib/alibaba1688Client");

const TO_PROVINCE_CODE = env.alibaba.TO_PROVINCE_CODE;
const TO_CITY_CODE = env.alibaba.TO_CITY_CODE;
const TO_COUNTRY_CODE = env.alibaba.TO_COUNTRY_CODE;

/** Logistics / customs cost constants (CNY) applied on top of 1688 freight. */
const COST_CONSTANTS = {
    base: 5,
    weightRate: 5,
    weight: 2,
    volumeRate: 20,
    volume: 1,
    holdingFees: 10,
    customDuties: 15,
};

const getShippingCostDetail = async (offerId, logisticsSkuNumModels, totalNum) => {
    const urlPath = client.urlPath(
        "com.alibaba.fenxiao.crossborder",
        "product.freight.estimate"
    );
    const result = await client.get(urlPath, {
        productFreightQueryParamsNew: JSON.stringify({
            offerId,
            toProvinceCode: TO_PROVINCE_CODE,
            toCityCode: TO_CITY_CODE,
            toCountryCode: TO_COUNTRY_CODE,
            totalNum,
            logisticsSkuNumModels,
        }),
    });
    return result.ok ? result.data : null;
};

/**
 * Call 1688 product.freight.estimate and split into delivery + tax (customs).
 * - deliveryFee: Alibaba freight + logistics (base / weight / volume / holding)
 * - tax: customs duties portion derived from API SKU freight models
 */
const calculateFreightAndTax = async (offerId, items, exchangeRate) => {
    const costs = COST_CONSTANTS;
    const empty = {
        deliveryFee: 0,
        tax: 0,
        freightCny: 0,
        logisticsCny: 0,
        customsCny: 0,
        source: "none",
    };

    if (!offerId) return empty;

    const logisticsSkuNumModels = [];
    for (const item of items) {
        if (item.sku_id) {
            logisticsSkuNumModels.push({
                skuId: item.sku_id,
                number: item.quantity,
            });
        }
    }

    const totalNumber = items.reduce((sum, item) => sum + item.quantity, 0);

    try {
        const shippingInfo = await getShippingCostDetail(offerId, logisticsSkuNumModels, totalNumber);
        if (!shippingInfo) {
            return { ...empty, source: "1688_empty" };
        }

        const { logisticsCny, customsCny } = calculateSkuCosts(
            logisticsSkuNumModels,
            shippingInfo?.productFreightSkuInfoModels,
            costs
        );
        const freightCny = Number(shippingInfo?.freight) || 0;

        return {
            deliveryFee: parseExchangeRate(logisticsCny + freightCny, exchangeRate),
            tax: parseExchangeRate(customsCny, exchangeRate),
            freightCny,
            logisticsCny,
            customsCny,
            source: "1688",
        };
    } catch (error) {
        console.error("Error calculating 1688 freight/tax:", error.message);
        return { ...empty, source: "error" };
    }
};

/** @deprecated Prefer calculateFreightAndTax — returns delivery + tax combined as shipping. */
const calculateShippingCost = async (offerId, items, exchangeRate) => {
    const result = await calculateFreightAndTax(offerId, items, exchangeRate);
    return helperRound(result.deliveryFee + result.tax);
};

const calculateSkuCosts = (skuInfos, freightModels = [], costs) => {
    let logisticsCny = 0;
    let customsCny = 0;

    if (!skuInfos.length) {
        const fallback = fallbackCalculation(costs);
        return {
            logisticsCny: fallback.logisticsCny,
            customsCny: fallback.customsCny,
        };
    }

    skuInfos.forEach((item) => {
        const matchingModel = freightModels.find((model) => String(model.skuId) === String(item.skuId));

        if (matchingModel) {
            const weightCost = Number(matchingModel.singleSkuWeight || 0) * costs.weightRate;
            const volume = (
                Number(matchingModel.singleSkuWidth || 0)
                * Number(matchingModel.singleSkuHeight || 0)
                * Number(matchingModel.singleSkuLength || 0)
            ) / 1_000_000;
            const volumeCost = volume * costs.volumeRate;

            logisticsCny += costs.base + weightCost + volumeCost + costs.holdingFees;
            customsCny += costs.customDuties;
        } else {
            const fallback = fallbackCalculation(costs);
            logisticsCny += fallback.logisticsCny;
            customsCny += fallback.customsCny;
        }
    });

    return { logisticsCny, customsCny };
};

const fallbackCalculation = (costs) => ({
    logisticsCny:
        costs.base
        + (costs.weight * costs.weightRate)
        + (costs.volume * costs.volumeRate)
        + costs.holdingFees,
    customsCny: costs.customDuties,
});

const parseExchangeRate = (amount, rate) =>
    Number((Number(amount) * Number(rate || 1)).toFixed(2));

const helperRound = (num) => Math.round(Number(num || 0) * 100) / 100;

module.exports = {
    calculateFreightAndTax,
    calculateShippingCost,
    getShippingCostDetail,
};

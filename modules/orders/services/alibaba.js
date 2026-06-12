const client = require("../../../lib/alibaba1688Client");

const TO_PROVINCE_CODE = env.alibaba.TO_PROVINCE_CODE;
const TO_CITY_CODE = env.alibaba.TO_CITY_CODE;
const TO_COUNTRY_CODE = env.alibaba.TO_COUNTRY_CODE;

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

const calculateShippingCost = async (offerId, items, exchangeRate) => {
    const costs = {
        base: 5,
        weightRate: 5,
        weight: 2,
        volumeRate: 20,
        volume: 1,
        holdingFees: 10,
        customDuties: 15,
    };

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
        const skuCost = calculateCostsForMatchingSKUs(
            logisticsSkuNumModels,
            shippingInfo?.productFreightSkuInfoModels,
            costs
        );
        const freightCny = Number(shippingInfo?.freight) || 0;
        const totalShippingCost = parseExchangeRate(skuCost + freightCny, exchangeRate);

        return totalShippingCost;
    } catch (error) {
        console.error("Error calculating shipping cost:", error.message);
        return null;
    }
};

const calculateCostsForMatchingSKUs = (skuInfos, freightModels = [], costs) => {
    let totalCost = 0;

    skuInfos.forEach((item) => {
        const matchingModel = freightModels.find((model) => String(model.skuId) === String(item.skuId));
        let skuCost;

        if (matchingModel) {
            const weightCost = Number(matchingModel.singleSkuWeight || 0) * costs.weightRate;
            const volume = (
                Number(matchingModel.singleSkuWidth || 0)
                * Number(matchingModel.singleSkuHeight || 0)
                * Number(matchingModel.singleSkuLength || 0)
            ) / 1_000_000;
            const volumeCost = volume * costs.volumeRate;

            skuCost = costs.base + weightCost + volumeCost + costs.holdingFees + costs.customDuties;
        } else {
            skuCost = fallbackCalculation(costs);
        }

        totalCost += skuCost;
    });

    return totalCost;
};

const fallbackCalculation = (costs) =>
    costs.base
    + (costs.weight * costs.weightRate)
    + (costs.volume * costs.volumeRate)
    + costs.holdingFees
    + costs.customDuties;

const parseExchangeRate = (amount, rate) =>
    Number((Number(amount) * rate).toFixed(2));

module.exports = { calculateShippingCost, getShippingCostDetail };

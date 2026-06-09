const axios = require('axios');
const crypto = require('crypto');

const ALIBABA_BASE_APP_URL = env.alibaba.BASE_APP_URL;
const ALIBABA_APP_KEY = env.alibaba.APP_KEY;
const ALIBABA_APP_SECRET = env.alibaba.APP_SECRET;
const ALIBABA_AUTH_TOKEN = env.alibaba.AUTH_TOKEN;
const TO_PROVINCE_CODE = env.alibaba.TO_PROVINCE_CODE;
const TO_CITY_CODE = env.alibaba.TO_CITY_CODE;
const TO_COUNTRY_CODE = env.alibaba.TO_COUNTRY_CODE;

const generateHmacSha1Signature = (data, secretKey) => {
    const hmac = crypto.createHmac('sha1', secretKey);
    hmac.update(data);
    return hmac.digest('hex').toUpperCase();
}

const generateApiSignature = (urlPath, params, secretKey) => {
    const paramString = Object.entries(params).sort(([keyA], [keyB]) => keyA.localeCompare(keyB)).map(([key, value]) => `${key}${value}`).join('');
    const concatString = `${urlPath}${paramString}`;
    const signature = generateHmacSha1Signature(concatString, secretKey);
    const urlParams = new URLSearchParams(params);
    urlParams.append('_aop_signature', signature);
    return `${urlPath}?${urlParams.toString()}`;
}

const makeApiCall = async (urlPath, params, secretKey) => {
    try {
        const signedUrl = generateApiSignature(urlPath, params, secretKey);
        const url = new URL(signedUrl, ALIBABA_BASE_APP_URL);
        const headers = { 'Content-Type': 'application/json' };
        const response = await axios.get(url.toString(), { headers });
        if (response.data?.result?.success)
            return response.data.result.result;
        return null;
    }
    catch (error) { console.error('API Call Error: Unsuccessful response', error); }
};

const getShippingCostDetail = async (offerId, logisticsSkuNumModels, totalNum) => {
    const urlPath = `param2/1/com.alibaba.fenxiao.crossborder/product.freight.estimate/${ALIBABA_APP_KEY}`;
    const params = {
        "productFreightQueryParamsNew": JSON.stringify({
            "offerId": offerId,
            "toProvinceCode": TO_PROVINCE_CODE,
            "toCityCode": TO_CITY_CODE,
            "toCountryCode": TO_COUNTRY_CODE,
            "totalNum": totalNum,
            "logisticsSkuNumModels": logisticsSkuNumModels,
        }),
        "access_token": ALIBABA_AUTH_TOKEN
    };
    const secretKey = ALIBABA_APP_SECRET;

    return makeApiCall(urlPath, params, secretKey);
};

const calculateShippingCost = async (offerId, items, exchangeRate) => {
    const costs = {
        base: 5,
        weightRate: 5, // per kg
        weight: 2, // kg
        volumeRate: 20, // per m³
        volume: 1, // m³
        holdingFees: 10,
        customDuties: 15
    };

    const logisticsSkuNumModels = [];
    for (const item of items) {
        if (item.sku_id) {
            logisticsSkuNumModels.push({
                skuId: item.sku_id,
                number: item.quantity
            });
        }
    };


    const totalNumber = items.reduce((sum, item) => sum + item.quantity, 0);

    try {

        const shippingInfo = await getShippingCostDetail(offerId, logisticsSkuNumModels, totalNumber);

        const skuCost = calculateCostsForMatchingSKUs(logisticsSkuNumModels, shippingInfo?.productFreightSkuInfoModels, costs);
        const totalShippingCost = parseExchangeRate(skuCost + shippingInfo?.freight || 2, exchangeRate)


        console.log("Total Estimated Shipping Cost:", totalShippingCost);

        return totalShippingCost;
    } catch (error) {
        console.error("Error calculating shipping cost:", error.message);
        return null;
    }
};

const calculateCostsForMatchingSKUs = (skuInfos, freightModels = [], costs) => {
    let totalCost = 0;

    return totalCost;
    skuInfos.forEach(item => {
        const matchingModel = freightModels.find(model => model.skuId === item.skuId);
        let skuCost;

        if (matchingModel) {
            const weightCost = matchingModel.singleSkuWeight * costs.weightRate;
            const volume = (matchingModel.singleSkuWidth * matchingModel.singleSkuHeight * matchingModel.singleSkuLength) / 1_000_000;
            const volumeCost = volume * costs.volumeRate;

            skuCost = costs.base + weightCost + volumeCost + costs.holdingFees + costs.customDuties;
        } else {
            skuCost = fallbackCalculation(costs);
        }

        totalCost += skuCost;
    });

    return totalCost;
};
const fallbackCalculation = (costs) => {

    // const totalShippingCost = costs.base + (costs.weight * costs.weightRate) +
    //     (costs.volume * costs.volumeRate) + costs.holdingFees + costs.customDuties;

    return costs.base + (costs.weight * costs.weightRate) +
        (costs.volume * costs.volumeRate) + costs.holdingFees + costs.customDuties;
};
const parseExchangeRate = (amount, rate) => {
    return Number((amount * rate).toFixed(2));
}

module.exports = { calculateShippingCost };
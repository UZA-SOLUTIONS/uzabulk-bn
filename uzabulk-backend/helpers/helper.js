const { attachProductMoqFields } = require('../modules/products/helper/moq');
const { attachProductSupplierFields } = require('../modules/products/helper/supplier');
const { attachProductRatingsFromStored } = require('../modules/products/helper/ratings');

const toFixedNumber = (number, toFixed = 2, string = false) => {
    return number;
}
const calculatePrice = (price, { exchangeRate, adminCommission = 10 }) => {
    if (!price) return 0;
    const exchangedPrice = price * exchangeRate;
    return toPercentage(exchangedPrice, adminCommission);
};

const processItemPrice = (item, options) => {
    if (item?.price) {
        item.price = calculatePrice(item.price, options);
    }

    if (item?.amount) {
        item.amount = calculatePrice(item.amount, options);
        item.unitPrice = calculatePrice(item.unitPrice, options);
    }

};
const processVariations = (variations, options) => {
    if (!variations) return;

    const calculateVariationPrices = (variation) => {
        variation.price = calculatePrice(variation.price, options);
        variation.compare_price = calculatePrice(variation.compare_price, options);
    };
    if (Array.isArray(variations)) {
        variations.forEach(calculateVariationPrices);
    } else if (typeof variations === 'object') {
        calculateVariationPrices(variations);
    }
};

// Main function
const exchange = (item, options) => {
    if (!item) return;

    attachProductRatingsFromStored(
        attachProductSupplierFields(attachProductMoqFields(item))
    );
    processItemPrice(item, options);
    processVariations(item.variations || item.variation, options);
};

const toPercentage = (amount, perc) => {
    return toFixedNumber(amount + ((amount * perc) / 100));
}

const priceExchange = async (data, { name, code, symbol, exchangeRate }) => {

    if (!data) {
        return data;
    }

    const adminCommission = 10;// await _model.StoreType.adminCommission();

    if (Array.isArray(data)) {
        for (const item of data) {
            exchange(item, { adminCommission, exchangeRate });
        }
    }
    else {
        exchange(data, { adminCommission, exchangeRate });
    }
    return data
}


const cartPriceChange = async (item, { exchangeRate }) => {
    if (item?.subTotal)
        item.subTotal = item.subTotal * exchangeRate;

    await priceExchange(item.product, req.exchangeRate);

    for (const cartItem of item.items) {
        cartItem.unitPrice = cartItem.unitPrice * exchangeRate;
        cartItem.amount = cartItem.amount * exchangeRate;
    }
}

const cartPriceExchange = async (items, { exchangeRate }) => {

    if (!items) {
        return items;
    }

    if (Array.isArray(items)) {
        for (const item of items) {
            cartPriceChange(item, { exchangeRate });
        }
    }
    else {
        cartPriceChange(items, { exchangeRate });
    }


    return items;
}


module.exports = {
    priceExchange,
    toFixedNumber,
    toPercentage,
    cartPriceExchange,
    calculatePrice,
}
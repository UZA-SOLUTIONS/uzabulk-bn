const productVariationTable = require('../../../models/productVariationTable');
const { generateOTP } = require('../../../utils');
let generateLineItems = async (item, { quantity, variation_id, variation_title }) => {
    let obj = {
        product: item._id,
        name: item.name,
        productImage: item.featured_image?.link,
        quantity: quantity,
    };

    if (item.type === "simple") {
        // Calculate price based on quantity and price tiers
        obj.price = item.price;

    } else {
        if (!variation_id) {
            throw "VARIATION_IS_REQUIRED";
        }
        const getVariation = await productVariationTable.getproductVariationById(variation_id);

        if (!getVariation) {
            throw "PRODUCT_VARIATION_IS_INVALID";
        }

        if (getVariation.manage_stock && getVariation.stock_quantity < quantity) {
            throw "OUT_OF_STOCK";
        }
        if (!getVariation.manage_stock && getVariation.stock_status === "outofstock") {
            throw "OUT_OF_STOCK";
        }

        obj.variation_id = getVariation._id;
        obj.variation_title = variation_title;
        obj.variation_price = getVariation.price;
        obj.price = getVariation.price;

        // Calculate price based on quantity and price tiers for the variation
        // obj.price = priceTiersItem(item.price, getVariation.priceTiers, quantity);
    }

    if (item.manage_stock && item.stock_quantity < obj.quantity) {
        throw "OUT_OF_STOCK";
    }
    if (!item.manage_stock && item.stock_status === "outofstock") {
        throw "OUT_OF_STOCK";
    }

    let lineItemTotal = obj.price * obj.quantity;
    obj.lineTotal = lineItemTotal;

    return obj;
};

let roundNumber = (num) => {
    return Math.round(num * 100) / 100;
};
let toFixedNumber = (num, toFix = 2) => {
    return Number(num.toFixed(toFix));
}
let generatorRandomNumber = (length) => {

    if (typeof length == "undefined")
        length = 2;
    var token = "";
    var possible = "123456789";
    for (var i = 0; i < length; i++)
        token += possible.charAt(Math.floor(Math.random() * possible.length));
    return token;
}
function validateCoupon(getCoupon, vendorId) {
    if (getCoupon.type === "global" ||
        (getCoupon.type === "vendor" && getCoupon.vendor.toString() === vendorId.toString())) {
        return true;
    } else {
        return false;
    }
}
function generateOrderID() {
    const date = new Date();
    date.setMilliseconds(0);

    // Get year, month, day, hours, minutes, and seconds
    // const year = date.getFullYear();
    // const month = String(date.getMonth() + 1).padStart(2, '0');
    // const day = String(date.getDate()).padStart(2, '0');
    // const hours = String(date.getHours()).padStart(2, '0');
    // const minutes = String(date.getMinutes()).padStart(2, '0');
    // const seconds = String(date.getSeconds()).padStart(2, '0');

    // Generate a random alphanumeric string
    // const randomString = Math.random().toString(36).substring(2, 10).toUpperCase();

    // Combine date, time, and random string to create the order ID
    // const orderId = `${year}${month}${day}${hours}${minutes}${seconds}-${randomString}`;
    const orderId = `UZA${`${date.getTime()}`.replace("000", "")}${generateOTP(4)}`;

    return orderId;
}
module.exports = {
    generateLineItems,
    roundNumber,
    toFixedNumber,
    generatorRandomNumber,
    validateCoupon,
    generateOrderID
};

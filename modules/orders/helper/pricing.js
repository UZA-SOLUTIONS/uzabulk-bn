const Coupon = require('../../../models/couponTable');
const Address = require('../../../models/addressTable');
const helper = require("../helper");
let couponDiscountCalculation = (getCoupon, itemTotal, isOder = false) => {
    let discountTotal = 0;
    let couponType = null;
    let couponAmount = 0;
    let couponBy = null;
    let mainTotal = itemTotal;

    if (getCoupon != null) {

        couponType = getCoupon.discount_type;
        couponAmount = getCoupon.amount;
        couponBy = getCoupon.type;

        if (getCoupon.discount_type === 'percent') {
            itemTotal = helper.roundNumber((itemTotal - ((itemTotal * getCoupon.amount) / 100)));
            discountTotal = helper.roundNumber(((mainTotal * getCoupon.amount) / 100));
        }

        if (getCoupon.discount_type === 'flat') {
            itemTotal = helper.roundNumber((itemTotal - getCoupon.amount));
            discountTotal = helper.roundNumber(getCoupon.amount);
        }
    } else {
        if (isOder)
            throw "PROMOCODE_COUPON_INVALID";
        return { error: "Invalid promo code." }
    };

    return {
        discountTotal: discountTotal,
        couponType: couponType,
        couponBy: couponBy,
        couponAmount: couponAmount,
        itemTotal: itemTotal
    }
}

let taxCalculation = (taxSettings, taxAmount = 0, subTotal) => {
    let tax = 0;

    if (taxSettings.level === "store") {
        taxAmount = taxSettings.percentage;
    }

    if (taxAmount != 0) {
        tax = helper.roundNumber(((subTotal * taxAmount) / 100));
    }

    return {
        tax: tax,
        taxAmount: taxAmount
    }
}

let deliveryFeeCalculation = async (data) => {
    let message = null;
    let error = false;
    let deliveryFee = 0;

    // If shipping address provided, return only delivery fee based on shipping address and vendor's store address
    if (data?.shippingDetails || data?.onlyCalculation) {
        data.deliveryFee = deliveryFee;
        return data;
    }


    if (!data.shipping_address) {
        message = 'ADDRESS_ID_IS_REQUIRED';
        error = true;
    };

    const getAddress = await Address.getAddressByIdAsync(data.shipping_address);

    if (getAddress == null) {
        message = "ADDRESS_IS_INVALID";
        error = true;
    };

    let shippingDetails = getAddress;
    let billingDetails = getAddress;

    if (data.billing_address) {
        const getAddress = await Address.getAddressByIdAsync(data.billing_address);

        if (getAddress == null) {
            message = "ADDRESS_IS_INVALID";
            error = true;
        };
        billingDetails = getAddress;
    }


    return {
        message,
        error,
        deliveryFee: deliveryFee,
        billingDetails: billingDetails,
        shippingDetails
    }
}

let caculateEarning = (taxSettings, subTotal, tax, tipAmount, deliveryFee, commission, isSingleVendor, discountTotal, couponBy) => {
    let vendorEarning = 0;
    let deliveryBoyEarning = 0;
    let adminEarning = 0;
    let adminVendorEarning = 0;
    let adminDeliveryBoyEarning = 0;
    if (couponBy && couponBy === "global") {
        subTotal = helper.roundNumber(subTotal + discountTotal);
    }

    if (commission.vendor) {
        adminVendorEarning = isSingleVendor ? subTotal : helper.roundNumber((subTotal - ((subTotal * commission.vendor) / 100)));
        vendorEarning = isSingleVendor ? 0 : helper.roundNumber(((subTotal * commission.vendor) / 100));
    }
    if (commission.deliveryBoy) {
        adminDeliveryBoyEarning = helper.roundNumber((deliveryFee - ((deliveryFee * commission.deliveryBoy) / 100)));
        deliveryBoyEarning = helper.roundNumber(((deliveryFee * commission.deliveryBoy) / 100));

    }

    adminEarning = isSingleVendor ? helper.roundNumber(adminVendorEarning + adminDeliveryBoyEarning + tax) : helper.roundNumber(adminVendorEarning + adminDeliveryBoyEarning + (taxSettings.level === "store" ? tax : 0));
    deliveryBoyEarning = helper.roundNumber(deliveryBoyEarning + tipAmount);
    vendorEarning = isSingleVendor ? 0 : helper.roundNumber(vendorEarning + (taxSettings.level === "vendor" ? tax : 0));

    if (couponBy && couponBy === "global") {
        adminEarning = helper.roundNumber(adminEarning - discountTotal);
    }

    return {
        vendorEarning: vendorEarning,
        deliveryBoyEarning: deliveryBoyEarning,
        adminVendorEarning: adminVendorEarning,
        adminDeliveryBoyEarning: adminDeliveryBoyEarning,
        adminEarning: adminEarning
    }
}

let calculateDeliveryBoyOverrideEarning = (deliveryFee, deliveryBoyEarning, adminDeliveryBoyEarning, adminEarning, commission) => {

    let newdeliveryBoyEarning = deliveryBoyEarning;
    let newadminDeliveryBoyEarning = adminDeliveryBoyEarning;

    if (commission.deliveryBoy) {
        newadminDeliveryBoyEarning = helper.roundNumber((deliveryFee - ((deliveryFee * commission.deliveryBoy) / 100)));
        newdeliveryBoyEarning = helper.roundNumber(((deliveryFee * commission.deliveryBoy) / 100));
        let adminEarningWithoutDeliveryBoy = helper.roundNumber(adminEarning - adminDeliveryBoyEarning);
        adminEarning = helper.roundNumber(newadminDeliveryBoyEarning + adminEarningWithoutDeliveryBoy);
    }

    return {
        deliveryBoyEarning: newdeliveryBoyEarning,
        adminDeliveryBoyEarning: newadminDeliveryBoyEarning,
        adminEarning: adminEarning
    }
}
let checkPromocodeUsed = async (vendor, user) => {
    try {
        let getCoupon = await Coupon.findOne({ code: code, status: "active", $or: [{ type: "vendor", vendor: vendor }, { type: "global" }] });
        if (getCoupon) {
            if (user) {
                let checkPomoUsedCount = await promoUse.findOne({ user: user._id, promoCodeId: getCoupon._id })
                if (checkPomoUsedCount) {
                    if (checkPomoUsedCount.count >= getCoupon.maxUse && getCoupon.maxUse) {
                        return true
                    }
                }
            }
        }
        return false
    } catch (error) {
        return false
    }
};

module.exports = {
    couponDiscountCalculation,
    taxCalculation,
    deliveryFeeCalculation,
    caculateEarning,
    calculateDeliveryBoyOverrideEarning,
    checkPromocodeUsed
}
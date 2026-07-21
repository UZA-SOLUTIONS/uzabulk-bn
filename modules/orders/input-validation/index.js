const productVariation = require('../../../models/productVariationTable');
const attribute = require('../../../models/attributeTable');
const attributeTerms = require('../../../models/attributeTermsTable');
const Pricing = require("../helper/pricing");
const helper = require("../helper/index");
const { priceExchange } = require('../../../helpers/helper');
const { calculateShippingCost } = require("../services/alibaba");
const ProductService = require("../services/product");

let generateLineItems = async (product, items) => {

    let itemArray = [];
    let itemTotal = 0;
    for (const item of items) {
        let obj = {
            product: product._id,
            productName: product.name,
            productImage: product.featured_image?.link,
            quantity: item.quantity,
        };
        if (product.type === "simple") {
            // Calculate price based on quantity and price tiers
            obj.price = item.price;

        } else {
            if (!item.variation_id) {
                throw "VARIATION_IS_REQUIRED";
            };
            const getVariation = await productVariation.getproductVariationById(item.variation_id);
            if (!getVariation) {
                throw "PRODUCT_VARIATION_IS_INVALID";
            };

            if (getVariation.manage_stock && getVariation.stock_quantity < item.quantity) {
                throw "OUT_OF_STOCK";
            }
            if (!getVariation.manage_stock && getVariation.stock_status === "outofstock") {
                throw "OUT_OF_STOCK";
            }

            let attrArray = await validateAttributes(item.attributes);

            obj.price = getVariation.price;
            obj.variation_id = getVariation._id;
            obj.sku_id = getVariation.skuId;
            obj.spec_id = getVariation.specId || getVariation.skuId;
            obj.attributes = attrArray;

        }
        if (product.manage_stock && product.stock_quantity < obj.quantity) {
            throw "OUT_OF_STOCK";
        };
        if (!product.manage_stock && product.stock_status === "outofstock") {
            throw "OUT_OF_STOCK";
        };
        obj.amount = obj.price * obj.quantity;
        obj.unitPrice = obj.price;
        itemArray.push(obj);
        itemTotal += obj.amount;
    };

    return { items: itemArray, itemTotal };
};
const validateVariation = async (variation_id, quantity) => {
    if (!variation_id) {
        throw "VARIATION_IS_REQUIRED";
    };
    const getVariation = await productVariation.getproductVariationById(variation_id);
    if (!getVariation) {
        throw "PRODUCT_VARIATION_IS_INVALID";
    };

    if (getVariation.manage_stock && getVariation.stock_quantity < quantity) {
        throw "OUT_OF_STOCK";
    }
    if (!getVariation.manage_stock && getVariation.stock_status === "outofstock") {
        throw "OUT_OF_STOCK";
    };
    return getVariation;
}
async function validateAttributes(attributes) {
    let attrArray = [];
    for (const attr of attributes) {
        const getAttr = await attribute.getAttributeById(attr.attrId);
        const getAttrTerm = await attributeTerms.getAttributeTermById(attr.attrTermId);

        if (!getAttr) {
            throw "PRODUCT_ATTRIBUTE_ID_IS_INVALID";
        };
        if (!getAttrTerm) {
            throw "PRODUCT_ATTRIBUTE_TERM_ID_IS_INVALID";
        };
        if (!attributeTermsValid(getAttr, getAttrTerm._id)) {
            throw "PRODUCT_ATTRIBUTE_TERMS_IS_INVALID";
        };

        attrArray.push({
            attrId: attr.attrId,
            attrTermId: attr.attrTermId,
            attrName: getAttr.name,
            attrValue: getAttrTerm.name,
            imageUrl: getAttrTerm.image?.link
        })
    };
    return attrArray;

};
function calculatePrice(priceTiers, quantity) {
    let price = 0;
    for (const tier of priceTiers) {
        price = tier.price;
        if ((quantity >= 1 && quantity >= tier.minQuantity) && (quantity <= tier.maxQuantity || tier.infinit)) {
            return tier.price;
        }
    }
    return price;
}

function attributeTermsValid(attr, termId) {
    return attr.terms.find(i => i.toString() === termId.toString());
}

const verifyAvailStock = (item) => {
    if (!item?.stock?.instock) {
        throw "The product \"" + (item.attributes.map((a) => a.attrValue)).join(" / ") + "\" is out of stock.";
    }
    else if (item?.stock?.instock && item?.stock?.quantity && item?.stock?.quantity < item.quantity) {
        throw "The product \"" + (item.attributes.map((a) => a.attrValue)).join(" / ") + "\" has only " + item?.stock?.quantity + " items(s) left.";
    }
}
let checkStock = async (items, isOrder = false) => {
    for (let index = 0; index < items.length; index++) {
        if (items[index].variation_id) {
            let variationData = await ProductService.variationById(items[index].variation_id, "manage_stock stock_quantity stock_status skuId specId");
            items[index].stock = {
                instock: variationData.manage_stock ? variationData.stock_quantity > 0 : (!variationData.manage_stock && variationData.stock_status === "instock" ? true : false),
                quantity: variationData.manage_stock ? variationData.stock_quantity : null,
            };
            items[index].sku_id = items[index].sku_id || variationData.skuId;
            items[index].spec_id = variationData.specId || variationData.skuId;
        }
        else {
            let productData = await ProductService.productById(items[index].product, "manage_stock stock_quantity stock_status");
            items[index].stock = {
                instock: productData.manage_stock ? productData.stock_quantity > 0 : (!productData.manage_stock && productData.stock_status === "instock" ? true : false),
                quantity: productData.manage_stock ? productData.stock_quantity : null,
            };
        }

        if (isOrder) {
            verifyAvailStock(items[index]);
        }
    }
}
let generateLineItemsForCheckOut = async (exchangeRateOpt, data, carts, addressInfo, isOrder = false) => {
    const { exchangeRate } = exchangeRateOpt;

    let subTotal = 0;
    let line_items = [];
    let totalItems = 0;

    for (let index = 0; index < carts.length; index++) {
        const element = carts[index];
        const items = element.items;

        // console.log(element.product);
        await priceExchange(element.product, exchangeRateOpt);
        // console.log(element.product);
        await priceExchange(element.items, exchangeRateOpt);

        const itemsSubTotal = items.reduce((total, item) => total + item.amount, 0);
        subTotal += itemsSubTotal;
        await checkStock(items, isOrder);
        totalItems += items.reduce((sum, item) => sum + item.quantity, 0);

        const { tax, taxAmount } = Pricing.taxCalculation(env.taxSettings, 0, itemsSubTotal);

        // Delivery fees are disabled storefront-wide — do not call 1688 freight.estimate
        // (60s timeout + retries was dominating checkout latency for a value we zero out).
        const skipFreight =
            data?.skipFreightEstimate === true
            || String(process.env.CHECKOUT_SKIP_FREIGHT_ESTIMATE ?? "true").toLowerCase() !== "false";
        let deliveryFee = 0;
        if (!skipFreight && data?.shippingDetails && element.product?.offerId) {
            deliveryFee = await calculateShippingCost(element.product.offerId, items, exchangeRate);
        }

        const discountTotal = 0;

        data.tax += tax;
        data.deliveryFee += deliveryFee;
        line_items.push({
            cart_id: element._id,
            cart_key: element.cart_key,
            vendor: element.product?.vendor,
            offerId: element.product?.offerId || "",
            subTotal: itemsSubTotal,
            items: items,
            tax,
            taxAmount,
            deliveryFee,
            discountTotal,
            finalAmount: helper.toFixedNumber((itemsSubTotal + deliveryFee + tax) - discountTotal),
        });
    };
    return { subTotal, totalItems, line_items };
}
let applyPromoOnLineItems = async (line_items, getCoupon, itemsSubTotal, isOrder = false) => {
    //total discount *  100 / sum of products  - follwing this Approach

    if (getCoupon.type === "vendor" && !validateVendorPromo(line_items, getCoupon)) {
        if (isOrder)
            throw "PROMOCODE_COUPON_INVALID";
        return { error: "Invalid promo code." };
    };

    let vendorItemsSubTotal = getCoupon.type === "vendor" ? calculateVendorItemsSubTotal(line_items, getCoupon.vendor) : itemsSubTotal;

    const { discountTotal, itemTotal, error } = Pricing.couponDiscountCalculation(getCoupon, vendorItemsSubTotal, isOrder);

    if (error) {
        return { error };
    }

    const perItemDiscountPercentage = (discountTotal * 100) / vendorItemsSubTotal;

    let totalDiscount = discountTotal;
    let totalSubTotal = itemTotal;
    for (const cart of line_items) {
        if (getCoupon.type === "vendor" && cart.vendor._id.toString() !== getCoupon.vendor.toString()) {
            // Skip this cart if the vendor does not match the coupon's vendor
            continue;
        };

        cart.discountTotal = helper.toFixedNumber(((cart.subTotal * perItemDiscountPercentage) / 100));

        for (const item of cart.items) {

            item.discountTotal = helper.toFixedNumber(((item.amount * perItemDiscountPercentage) / 100));
        };
    }

    return { discountTotal: totalDiscount, subTotal: totalSubTotal, line_items };
};
const validateVendorPromo = (items, getCoupon) => {
    return items.some(item => item.vendor?._id.toString() === getCoupon.vendor.toString());
};
const calculateVendorItemsSubTotal = (line_items, vendorId) => {
    return line_items.reduce((total, item) => {
        if (item.vendor?._id.toString() === vendorId.toString()) {
            total += item.subTotal;
        }
        return total;
    }, 0);
};
module.exports = {
    generateLineItems,
    generateLineItemsForCheckOut,
    applyPromoOnLineItems
};

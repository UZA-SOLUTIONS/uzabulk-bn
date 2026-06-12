const productModel = require('../../../models/productsTable');
const productVariation = require('../../../models/productVariationTable');
const attribute = require('../../../models/attributeTable');
const attributeTerms = require('../../../models/attributeTermsTable');

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
            obj.price = product.price;

            if ((!product.manage_stock && product.stock_status === "outofstock") || (product.manage_stock && product.stock_quantity < 0)) {
                throw "The product is out of stock.";
            }
            else if (product.manage_stock && product.stock_quantity < item.quantity) {
                throw "The product has only " + product.stock_quantity + " items(s) left.";
            }

        } else {
            if (!item.variation_id) {
                throw "VARIATION_IS_REQUIRED";
            };
            const getVariation = await productVariation.getproductVariationById(item.variation_id);
            if (!getVariation) {
                throw "PRODUCT_VARIATION_IS_INVALID";
            };

            if ((!getVariation.manage_stock && getVariation.stock_status == "outofstock") || (getVariation.manage_stock && getVariation.stock_quantity < 0)) {
                throw "The product \"" + (getVariation.attributes.map((a) => a.name)).join(" / ") + "\" is out of stock.";
            }
            else if (getVariation.manage_stock && getVariation.stock_quantity < item.quantity) {
                throw "The product \"" + (getVariation.attributes.map((a) => a.name)).join(" / ") + "\" has only " + getVariation.stock_quantity + " items(s) left.";
            }

            let attrArray = await validateAttributes(item.attributes);

            obj.price = getVariation.price;
            obj.variation_id = getVariation._id;
            obj.sku_id = getVariation.skuId;
            obj.spec_id = getVariation.specId || getVariation.skuId;
            obj.attributes = attrArray;

        }
        obj.amount = obj.price * obj.quantity;
        obj.unitPrice = obj.price;
        itemArray.push(obj);
        itemTotal += obj.amount;
    };


    return { items: itemArray, itemTotal };
};
const updateCartItems = async (cartItems, items, product, operateType) => {
    try {
        switch (operateType) {
            case "UPDATE":
                return updateItems(cartItems, items, product);
            case "MANUAL_DELETED":
                return removeItems(cartItems, items, product);
            default:
                throw new Error("Invalid operation type");
        }
    } catch (error) {
        console.error("error", error)
        throw error;
    }
};

const updateItems = async (cartItems, items, product) => {
    for (const newItem of items) {
        let found = false;
        for (let i = 0; i < cartItems.length; i++) {
            if (cartItems[i]._id.toString() === newItem._id.toString()) {
                const previousQuantity = cartItems[i].quantity || 0;
                let quantity = newItem.quantity || cartItems[i].quantity;
                cartItems[i].quantity = quantity;
                cartItems[i].amount = quantity * cartItems[i].unitPrice;

                if (newItem.variation_id) {
                    let attrArray = await validateAttributes(newItem.attributes);
                    cartItems[i].variation_id = newItem.variation_id;
                    cartItems[i].attributes = attrArray;
                    await validateVariation(cartItems[i]);
                } else {

                    const productData = await productModel.findById(cartItems[i].product).lean();
                    if (previousQuantity && previousQuantity < quantity) {
                        if ((!productData.manage_stock && productData.stock_status === "outofstock") || (productData.manage_stock && productData.stock_quantity === 0)) {
                            cartItems[i].quantity = 0;
                        }
                        else if (productData.manage_stock && productData.stock_quantity < quantity) {
                            cartItems[i].quantity = productData.stock_quantity;
                            cartItems[i].message = "The product has only " + productData.stock_quantity + " items(s) left.";
                        }
                    }
                }
                found = true;
                break;
            }
        };
        if (!found) {
            throw "Item not found in cart for updating";
        };
    }

    return { items: cartItems, itemTotal: cartItems.reduce((total, cart) => cart.amount + total, 0) };
};
const removeItems = async (cartItems, items, product) => {
    for (const newItem of items) {
        let found = false;
        for (let i = 0; i < cartItems.length; i++) {
            if (cartItems[i]._id.toString() === newItem._id.toString()) {
                cartItems.splice(i, 1);
                found = true;
                break;
            }
        };
        if (!found) {
            throw "Item not found in cart for removing";
        };
    };

    return { items: cartItems, itemTotal: cartItems.reduce((total, cart) => cart.quantity + total, 0) };
};
const validateVariation = async (cartVariation) => {
    if (!cartVariation.variation_id) {
        throw "VARIATION_IS_REQUIRED";
    };
    const variation = await productVariation.getproductVariationById(cartVariation.variation_id);
    if (variation) {
        cartVariation.message = "";
        if ((!variation.manage_stock && variation.stock_status === "outofstock") || (variation.manage_stock && variation.stock_quantity === 0)) {
            cartVariation.quantity = 0;
        }
        else if (variation.manage_stock && variation.stock_quantity < cartVariation.quantity) {
            cartVariation.quantity = variation.stock_quantity
            cartVariation.message = "The product \"" + (variation.attributes.map((a) => a.name)).join(" / ") + "\" has only " + variation.stock_quantity + " items(s) left.";
        }
    }
    else {
        throw "PRODUCT_VARIATION_IS_INVALID";
    }

    return variation;
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
        if (!attributeTermsValid(getAttr._id, getAttrTerm)) {
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

function attributeTermsValid(attrId, attrTerm) {
    return attrTerm.attribute?.toString() === attrId.toString();
};
let addInExistanceCart = (product, existingItems, newItems) => {
    let addItems = [];
    let itemTotal = 0;
    for (const newItem of newItems) {
        let existingItem = existingItems.find(item => item.product.toString() === product._id.toString()
            && (product.type === "simple" || item.variation_id?.toString() === newItem.variation_id?.toString())
        );
        if (existingItem) {
            // Update the existing item
            existingItem.quantity += newItem.quantity;
            existingItem.amount = newItem.unitPrice * existingItem.quantity;
            existingItem.unitPrice = newItem.unitPrice;
            itemTotal += existingItem.amount;
        } else {
            addItems.push(newItem);
            itemTotal += newItem.amount;
        }
    };

    // Merge updated items and new items into existing items
    let appendExistItems = [...existingItems, ...addItems];

    return { items: appendExistItems, subTotal: itemTotal };
}

module.exports = {
    generateLineItems,
    addInExistanceCart,
    updateCartItems
};

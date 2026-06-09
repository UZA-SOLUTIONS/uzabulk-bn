const Product = require('../../../models/productsTable');
const Variation = require('../../../models/productVariationTable');

let productById = (id, select = null) => {
    return Product.findById(id, select).lean();
}

let variationById = (id, select = null) => {
    return Variation.findById(id, select).lean();
}

let updateProductStock = async (id, quantity, session) => {
    const data = await Product.findById(id).session(session).exec();
    if (data) {
        if (data.manage_stock) {
            data.stock_quantity = Math.max(0, data.stock_quantity - quantity);
            await data.save({ session });
        }
    }
}

let updateVariationStock = async (id, quantity, session) => {
    const data = await Variation.findById(id).session(session).exec();
    if (data) {
        if (data.manage_stock) {
            data.stock_quantity = Math.max(0, data.stock_quantity - quantity);
            await data.save({ session });
        }
    }
}

module.exports = {
    productById,
    variationById,
    updateProductStock,
    updateVariationStock,
}
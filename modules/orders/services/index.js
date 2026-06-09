const Product = require('../../../models/productsTable');
const Order = require('../../../models/ordersTable');
const Cart = require('../../../models/cartTable');

let getProduct = (query) => {
    return Product.findOne(query)
        .populate({ path: "featured_image", select: "link -_id" })
        .populate({ path: "variations", select: "-meta_data", options: { lean: true } })
        .select({ ...productProjection, type: 1 })
        .lean()
}
let addToCart = async (data) => {
    return Cart.create(data);
};

let updateCart = async (query, data) => {
    return Cart.findOneAndUpdate(query, data, { new: true, lean: true });
};

let cartList = async (query) => {
    return Cart.find(query).lean();
}
let countData = async (query) => {
    return Cart.countDocuments(query);
}

let productProjection = {
    "name": 1,
    "price": 1,
    "bestSeller": 1,
    "compare_price": 1,
    "featured_image": 1,
    "average_rating": 1,
    "rating_count": 1,
    "short_description": 1,
    "isFeatured": 1
}

module.exports = {
    countData,
    addToCart,
    getProduct,
    cartList,
    updateCart
}
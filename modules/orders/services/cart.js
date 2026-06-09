const Product = require('../../../models/productsTable');
const Cart = require('../../../models/cartTable');
const ProductService = require("./product");

let getProduct = (query) => {
    return Product.findOne(query)
        .populate({ path: "featured_image", select: "link -_id" })
        .populate({ path: "variations", select: "-meta_data", options: { lean: true } })
        .select({ ...productProjection, type: 1 })
        .lean()
}

let updateLatestPricing = async (cart) => {
    for (let index = 0; index < cart.length; index++) {
        cart[index].items = await Promise.all(cart[index].items?.map(async (item) => {
            item.unitPrice = cart[index].product.price || item.unitPrice;
            if (item.variation_id) {
                item.variation = await ProductService.variationById(item.variation_id);
                item.unitPrice = item?.variation?.price || item.unitPrice;
            }
            item.amount = item.unitPrice * item.quantity;
            return item;
        }));
    }
}

let cartList = async (reqQuery) => {
    let query = { ...reqQuery, status: "process" };
    return await Cart.find(query)
        .populate({
            path: "product",
            select: "name attributes price offerId",
            populate: [
                {
                    path: "featured_image",
                    select: "link -_id"
                },
                {
                    path: "vendor",
                    select: "name",
                    options: { lean: true }
                }
            ]
        })
        .lean();
}
let countData = async (query) => {
    return Cart.countDocuments(query);
};
let clearCart = async (query) => {
    return Cart.updateOne(query, { status: "success" });
}

let clearCartByIds = async (ids) => {
    return Cart.deleteMany({ _id: ids });
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
    getProduct,
    cartList,
    clearCart,
    updateLatestPricing,
    clearCartByIds,
}
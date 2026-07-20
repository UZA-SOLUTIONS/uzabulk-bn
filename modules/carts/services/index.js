const Product = require('../../../models/productsTable');
const Variation = require('../../../models/productVariationTable');
const Cart = require('../../../models/cartTable');


let cartCount = async (query) => {
    const result = await Cart.aggregate([
        {
            $match: {
                ...query,
                status: "process"
            }
        },
        {
            $group: {
                _id: null,
                items: {
                    $push: "$items"
                }
            }
        },
        {
            $unwind: "$items"
        },
        {
            $unwind: "$items"
        },
        {
            $group: {
                _id: null,
                count: {
                    $sum: "$items.quantity"
                }
            }
        }
    ]);

    return result[0]?.count || 0;
}

let getProduct = (query) => {
    return Product.findOne(query)
        .populate({ path: "featured_image", select: "link -_id" })
        .lean()
}
let addToCart = async (data) => {
    return Cart.create(data);
};

let updateCart = async (query, data) => {
    return Cart.findOneAndUpdate(query, data, { new: true, lean: true });
};

let updateItemPricing = (items, product) => {
    return Promise.all(items?.map(async (item) => {
        item.unitPrice = product.price || item.unitPrice;
        if (item.variation_id) {
            item.variation = await Variation.findById(item.variation_id);
            item.unitPrice = item?.variation?.price || item.unitPrice;
        }
        item.amount = item.unitPrice * item.quantity;
        return item;
    }));
}

let updateLatestPricing = async (cart) => {
    if (Array.isArray(cart)) {
        for (let index = 0; index < cart.length; index++) {
            cart[index].items = await updateItemPricing(cart[index].items, cart[index].product);
        }
    }
    else {
        cart.items = await updateItemPricing(cart.items, cart.product);
    }
}

let cartList = async (query) => {
    const { attachProductMoqFields } = require("../../products/helper/moq");
    const rows = await Cart.find(query)
        .populate({
            path: "product",
            select: "name attributes price minQuantity min_order_qty moq minimumOrderQuantity minOrderQuantity price_tiers",
            populate: [
                {
                    path: "featured_image",
                    select: "link -_id"
                },
                {
                    path: "variations",
                    select: "-meta_data",
                    options: { lean: true }
                }
            ]
        })
        .lean();

    return (rows || []).map((row) => {
        if (!row?.product) return row;
        const product = attachProductMoqFields({ ...row.product });
        // Populate returns { link }; storefront img tags expect a string URL.
        if (product.featured_image && typeof product.featured_image === "object") {
            product.featured_image = product.featured_image.link || "";
        }
        return { ...row, product };
    });
}

let findOne = async (query) => {
    return Cart.findOne(query).populate({
        path: "product",
        select: "name attributes",
        populate: { path: "variations", select: "-meta_data", options: { lean: true } }
    }).lean();
}
let countData = async (query) => {
    return Cart.countDocuments(query);
}

let getExistanceCart = async (query) => {
    return Cart.findOne({ ...query, status: "process" })
        .lean();
}
let removeCart = async (query) => {
    return Cart.deleteOne(query);
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
    updateCart,
    getExistanceCart,
    removeCart,
    findOne,
    updateLatestPricing,
    cartCount,
}
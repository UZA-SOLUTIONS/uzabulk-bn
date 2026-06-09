const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');


let itemsSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: String,
    productImage: String,
    quantity: Number,
    unitPrice: Number,
    amount: Number,
    variation_id: String,
    sku_id: String,
    attributes: [
        {
            attrId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attribute' },
            attrTermId: { type: mongoose.Schema.Types.ObjectId, ref: 'AttributeTerm' },
            attrName: String,
            attrValue: String,
            imageUrl: String
        }
    ],
    selected: Boolean
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } })

let schema = mongoose.Schema({
    cart_key: { type: String, default: uuidv4() },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deviceId: String,
    cartType: { type: String, enum: ["default", "temp"], default: "default" },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    subTotal: { type: Number, default: 0 },
    items: [itemsSchema],
    status: { type: String, enum: ["process", "success"], default: "process" },
    date_created: { type: Date },
    date_created_utc: { type: Date },
    date_modified: { type: Date },
    date_modified_utc: { type: Date },
    meta_data: [
        {
            key: { type: String },
            value: { type: String }
        }
    ]
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

schema.pre('save', function (next) {
    if (!this.cart_key) {
        this.cart_key = uuidv4();
        this.date_created_utc = new Date();
    }

    next();
});

schema.statics = {
    checkout: async function (query) {
        query = { ...query, status: "process" };
        return this.find(query)
            .populate({
                path: "product",
                select: "name attributes price featured_image",
                populate: [
                    // {
                    //     path: "featured_image",
                    //     select: "link -_id"
                    // },
                    {
                        path: "vendor",
                        select: "name",
                        options: { lean: true }
                    }
                ]
            })
            .lean();
    },
    clear: function (_id) {
        return this.deleteMany({ _id });
    }
}

const cartTable = module.exports = mongoose.model('Cart', schema);

module.exports.getCartByKey = (cart_key, callback) => {
    cartTable.find({ cart_key: cart_key }, callback);
}

//add Cart
module.exports.addcart = function (data, callback) {
    var query = { cart_key: data.cart_key, product: data.product };
    data.status = "process";
    cartTable.findOneAndUpdate(query, data, { upsert: true, new: true }, callback);
}

//update Cart
module.exports.updatecart = function (data, callback) {
    var query = { _id: data.cartId };
    cartTable.findOneAndUpdate(query, data, { upsert: true, new: true }, callback);
}

//get Cart by id
module.exports.getcartById = (id, callback) => {
    cartTable.findById(id, callback);
}

module.exports.getcartByIdAsync = (id, callback) => {
    return cartTable.findById(id, callback);
}

//remove Cart
module.exports.removecart = (id, callback) => {
    let query = { _id: id };
    cartTable.remove(query, callback);
}
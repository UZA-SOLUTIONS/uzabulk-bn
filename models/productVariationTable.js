const mongoose = require('mongoose');

let productVariationSchema = new mongoose.Schema({
    description: { type: String },
    image: { type: String },
    sku: { type: String, default: null },
    skuId: String,
    specId: String,
    price: { type: Number, default: 0 },
    compare_price: { type: Number, default: 0 },
    manage_stock: { type: Boolean, default: false },
    stock_quantity: { type: Number, default: 0 },
    stock_status: { type: String, enum: ['instock', 'outofstock'], default: "instock" },
    attributes: { type: Array, default: [] },
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
},
    {
        versionKey: false
    });

productVariationSchema.index({ skuId: 1 }, { name: "migration", background: false });
productVariationSchema.index({ specId: 1 }, { name: "specId_lookup", background: true });

const productVariationTable = module.exports = mongoose.model('productVariation', productVariationSchema);

module.exports.getproductVariationById = (id) => {
    return productVariationTable.findById(id).lean();
}

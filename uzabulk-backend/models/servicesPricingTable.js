const mongoose = require('mongoose');

let serviceSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    price: { type: Number, required: true },
    enabled: { type: Boolean, default: true },
    archive: { type: Boolean, enum: [0, 1], default: 0 },
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
        versionKey: false // You should be aware of the outcome after set to false
    });


const Service = module.exports = mongoose.model('servicePricing', serviceSchema);
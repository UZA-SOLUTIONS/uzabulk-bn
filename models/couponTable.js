const mongoose = require('mongoose');

let CouponSchema = new mongoose.Schema({
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    geoFence: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Geofence' }],
    maxUse: { type: Number, default: 0 },
    storeType: { type: mongoose.Schema.Types.ObjectId, ref: 'storeType' },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    code: { type: String, required: true, trim: true, uppercase: true },
    amount: { type: Number },
    type: { type: String, enum: ["global", "vendor"], default: "vendor" },
    restrictArea: { type: String, enum: ["none", "radius"], default: "none" },
    discount_type: { type: String, enum: ["percent", "flat"], default: "percent" },
    description: { type: String, required: true },
    status: { type: String, enum: ["active", "inactive", "archived", "expired"], default: "active" },
    start_date: { type: Date },
    date_expires: { type: Date },
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


const CouponTable = module.exports = mongoose.model('Coupon', CouponSchema);


module.exports.getCoupon = function (code) {
    let query = { code: { $regex: `^${code}$` }, status: "active" };
    return CouponTable.findOne(query).lean();
};

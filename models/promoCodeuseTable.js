const mongoose = require('mongoose');

let CouponSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    code: { type: String },
    count: { type: Number, default: 0 },
    date_created: { type: Date },
    date_created_utc: { type: Date },
    date_modified: { type: Date },
    date_modified_utc: { type: Date }
});


const CouponTable = module.exports = mongoose.model('PromoCodeUse', CouponSchema);
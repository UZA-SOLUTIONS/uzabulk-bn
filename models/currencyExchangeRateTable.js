const mongoose = require('mongoose');
const { defaultExchangeRate } = require('../config/db/constants');

let schema = mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true },
    symbol: { type: String, required: true },
    exchangeRate: { type: Number, required: true },
    imageUrl: String,
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    date_created: { type: Date },
    date_created_utc: { type: Date },
    date_modified: { type: Date },
    date_modified_utc: { type: Date },
}, { versionKey: false });

schema.statics = {
    createDefault: async function () {
        const hasData = await this.find();
        if (!hasData?.length) {
            this.create({
                ...defaultExchangeRate,
                date_created: new Date(),
                date_created_utc: new Date(),
                date_modified: new Date(),
                date_modified_utc: new Date(),
            });
        }
    }
}

module.exports = mongoose.model('CurrencyExchangeRate', schema);
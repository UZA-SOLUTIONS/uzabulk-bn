const mongoose = require('mongoose');

let paymentLedgerSchema = mongoose.Schema({
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    storeType: { type: mongoose.Schema.Types.ObjectId, ref: 'storeType' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    payment_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    payment_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    referee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    charge_id: { type: String },
    refund_id: { type: String },
    refund: { type: Number },
    type: { type: String, enum: ["credit", "debit", "earned", "charge"] },
    status: { type: String, enum: ["success", "failed", "error"], default: "success" },
    userType: { type: String, enum: ["DRIVER", "VENDOR", "ADMIN", "STORE", "USER"] },
    description: { type: String },
    amount: { type: Number },
    adminVendorEarning: { type: Number },
    adminDeliveryBoyEarning: { type: Number },
    isPay: { type: Boolean, default: false },
    balance: { type: Number },
    paymentMethod: { type: String },
    transactionId: { type: String },
    paymentDetails: { type: Object },
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

const paymentLedgerTable = module.exports = mongoose.model('paymentLedger', paymentLedgerSchema);

module.exports.getTransaction = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    paymentLedgerTable.aggregate([
        { $match: obj },
        { $lookup: { from: 'users', localField: 'payment_to', foreignField: '_id', as: 'customerDetails' } },
        { $lookup: { from: 'storetypes', localField: 'storeType', foreignField: '_id', as: 'storeType' } },
        { $sort: { [sortByField]: parseInt(sortOrder) } }, { $skip: (paged - 1) * pageSize },
        { $limit: parseInt(pageSize) },
        { $unwind: { path: "$customerDetails", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$storeType", preserveNullAndEmptyArrays: true } },
        { $project: { store: 1, payment_to: 1, order: 1, payment_by: 1, type: 1, userType: 1, description: 1, amount: 1, refund: 1, charge_id: 1, refund_id: 1, adminVendorEarning: 1, adminDeliveryBoyEarning: 1, balance: 1, date_created_utc: 1, customerDetails: { _id: 1, name: 1 }, storeType: { _id: 1, storeType: 1 } } }
    ], callback);
}
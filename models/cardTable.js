const mongoose = require('mongoose');
const Config = require('../config/constants.json');

let cardSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    payment_method: { type: String, enum: Config.PAYMENTGATEWAY },
    last4digit: { type: String },
    type: { type: String }, //visa..
    logo: { type: String },
    token: { type: String },
    details: { type: Object },
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

const cardTable = module.exports = mongoose.model('Card', cardSchema);

//get all card
module.exports.getCards = function (callback, limit) {
    cardTable.find(callback).limit(limit);
}

//Get User Card
module.exports.getUserCard = function (data, callback) {
    cardTable.find({ user: data }, callback).sort({ date_created_utc: -1 });
}

module.exports.getUserCardByPaymentMethod = function (data, callback) {
    return cardTable.find({ user: data.user, payment_method: data.payment_method }, callback).sort({ date_created_utc: -1 });
}
module.exports.getUserCardByPayment360 = function (data, callback) {
    return cardTable.find({ user: data.user, payment_method: data.payment_method, "details.status": true }, callback).sort({ date_created_utc: -1 });
}

module.exports.getUserCardByPay360 = function (data, url, callback) {
    return cardTable.aggregate([
        {
            $match: {
                user: data.user,
                payment_method: data.payment_method,
                "details.status": true
            }
        },
        {
            $addFields: { weburl: url }
        },
        {
            $project: {
                _id: 1,
                last4digit: 1,
                user: 1,
                date_created_utc: 1,
                details: 1,
                logo: 1,
                payment_method: 1,
                token: 1,
                type: 1,
                webViewUrl: { $concat: ["$weburl", "&ref=", { $toString: "$_id" }] },
                header: "Pay with Pay360"
            }

        }
    ])
}

module.exports.getUserCardAsync = function (data, callback) {
    return cardTable.find({ user: data.user }, callback).sort({ date_created_utc: -1 });
}

//get card async
module.exports.getCardAsync = function (callback) {
    return cardTable.find(callback);
}

//add card
module.exports.addCard = function (data, callback) {
    var query = { last4digit: data.last4digit, user: data.user }
    data.date_created_utc = new Date();
    cardTable.findOneAndUpdate(query, data, { new: true, upsert: true }, callback);
}

module.exports.cardAddPay360 = function (data, query, callback) {
    // var query = qu
    data.date_created_utc = new Date();
    cardTable.findOneAndUpdate(query, data, { new: true, upsert: true }, callback);
}

module.exports.addCardByBraintree = function (data, callback) {
    var query = { payment_method: data.payment_method, user: data.user }
    data.date_created_utc = new Date();
    cardTable.findOneAndUpdate(query, data, { new: true, upsert: true }, callback);
}

module.exports.updateCard = function (data, callback) {
    var query = { _id: data.cardId }
    data.date_modified_utc = new Date();
    cardTable.findOneAndUpdate(query, data, { new: true }, callback);
}

//get Card by id
module.exports.getCardById = (id, callback) => {
    cardTable.findById(id, callback);
}

module.exports.getCardByIdAsync = (id, callback) => {
    return cardTable.findById(id, callback);
}

//remove card
module.exports.removeCard = (id, callback) => {
    var query = { _id: id };
    cardTable.deleteOne(query, callback);
}
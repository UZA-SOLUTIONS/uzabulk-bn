const mongoose = require('mongoose');

let PromotionSchema = mongoose.Schema({
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    storeTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'storeType' },
    promotionName: { type: String, required: true },
    promotionImage: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
    type: { type: String, enum: ["singleVendor", "multiVendor"], required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    status: { type: String, enum: ["active", "inactive", "archived"], default: "active" },
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

const PromotionTable = module.exports = mongoose.model('Promotion', PromotionSchema);

//get all promotion
module.exports.getPromotions = function (callback, limit) {
    PromotionTable.find(callback).limit(limit);
}

module.exports.getUserPromotionAsync = function (data, callback) {
    return PromotionTable.find({ user: data.user }, callback).sort({ date_created_utc: -1 });
}

//get promotion async
module.exports.getPromotionAsync = function (callback) {
    return PromotionTable.find(callback);
}

//add promotion
module.exports.addPromotion = function (data, callback) {
    data.date_created_utc = new Date();
    PromotionTable.create(data, callback);
}

module.exports.updatePromotion = function (data, callback) {
    var query = { _id: data._id }
    data.date_modified_utc = new Date();
    PromotionTable.findOneAndUpdate(query, data, { new: true }, callback);
}

module.exports.updateStatusByIds = (data, update, callback) => {
    let query = { _id: { $in: data._id } }
    PromotionTable.updateMany(query, update, { "new": true }, callback);
}

module.exports.getPromotionByCode = (code, callback) => {
    return PromotionTable.findOne({ code: code }, callback);
}

//get Promotion by id
module.exports.getPromotionById = (id, callback) => {
    PromotionTable.findById(id).populate('vendor').populate('category').populate('promotionImage').exec(callback);
}
module.exports.getPromotionByStoreId = (id, callback) => {
    PromotionTable.findOne(id).populate('vendor').populate('category').populate('promotionImage').exec(callback);
}

module.exports.getPromotionByIdAsync = (id, callback) => {
    return PromotionTable.findById(id, callback);
}

//remove promotion
module.exports.removePromotion = (id, callback) => {
    var query = { _id: id };
    PromotionTable.remove(query, callback);
}

module.exports.getPromotionWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    PromotionTable.aggregate([{ $match: obj },
    { $lookup: { from: 'files', localField: 'promotionImage', foreignField: '_id', as: 'promotionImage' } },
    { $unwind: { path: "$promotionImage", preserveNullAndEmptyArrays: true } },
    { $sort: { [sortByField]: parseInt(sortOrder) } },
    { $skip: (paged - 1) * pageSize },
    { $limit: parseInt(pageSize) },
    ], callback);
}

module.exports.getStoreTypePromotions = (query, callback) => {
    PromotionTable.find(query).sort({ _id: -1 }).populate("promotionImage", "link").exec(callback);
}
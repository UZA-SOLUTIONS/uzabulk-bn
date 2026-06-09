const mongoose = require('mongoose');

let BusinessTypeSchema = mongoose.Schema({
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    storeType: { type: mongoose.Schema.Types.ObjectId, ref: 'storeType' },
    name: { type: String, required: true },
    image: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
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

const BusinessTypeTable = module.exports = mongoose.model('BusinessType', BusinessTypeSchema);

//add Cuisine
module.exports.addBusinessType = function (data, callback) {
    data.date_created_utc = new Date();
    BusinessTypeTable.create(data, callback);
}
//update Cuisine
module.exports.updateBusinessType = function (data, callback) {
    var query = { _id: data._id };
    BusinessTypeTable.findOneAndUpdate(query, data, { upsert: true, new: true }, callback);
}
module.exports.updateStatusByIds = (data, update, callback) => {
    let query = { _id: { $in: data._id } }
    BusinessTypeTable.updateMany(query, update, { "new": true }, callback);
}
//get Cuisine by id
module.exports.getCuisineById = (id, callback) => {
    BusinessTypeTable.findById(id).populate('image').exec(callback);
}
module.exports.getBusinessTypeByStoreId = (id, callback) => {
    BusinessTypeTable.findOne(id).populate('image').exec(callback);
}
//remove Cuisine
module.exports.removeBusinessType = (id, callback) => {
    let query = { _id: id };
    BusinessTypeTable.remove(query, callback);
}
module.exports.geBUsinessTypeWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    BusinessTypeTable.aggregate([{ $match: obj },
    { $sort: { [sortByField]: parseInt(sortOrder) } },
    { $skip: (paged - 1) * pageSize },
    { $limit: parseInt(pageSize) },
    ], callback);
}
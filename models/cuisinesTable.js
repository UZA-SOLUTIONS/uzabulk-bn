const mongoose = require('mongoose');

let CuisineSchema = mongoose.Schema({
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

const CuisineTable = module.exports = mongoose.model('Cuisine', CuisineSchema);

//add Cuisine
module.exports.addCuisine = function (data, callback) {
    data.date_created_utc = new Date();
    CuisineTable.create(data, callback);
}

//update Cuisine
module.exports.updateCuisine = function (data, callback) {
    var query = { _id: data._id };
    CuisineTable.findOneAndUpdate(query, data, { upsert: true, new: true }, callback);
}

module.exports.updateStatusByIds = (data, update, callback) => {
    let query = { _id: { $in: data._id } }
    CuisineTable.updateMany(query, update, { "new": true }, callback);
}

//get Cuisine by id
module.exports.getCuisineById = (id, callback) => {
    CuisineTable.findById(id).populate('image').exec(callback);
}
module.exports.getCuisineByStoreId = (id, callback) => {
    CuisineTable.findOne(id).populate('image').exec(callback);
}

//remove Cuisine
module.exports.removeCuisine = (id, callback) => {
    let query = { _id: id };
    CuisineTable.remove(query, callback);
}

module.exports.geCuisinesWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    CuisineTable.aggregate([{ $match: obj },
    { $sort: { [sortByField]: parseInt(sortOrder) } },
    { $skip: (paged - 1) * pageSize },
    { $limit: parseInt(pageSize) },
    ], callback);
}

module.exports.geCuisinesWithFilterImage = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    CuisineTable.aggregate([{ $match: obj },
    {
        $lookup: {
            from: "files",
            localField: "image",
            foreignField: "_id",
            as: "image",
        },
    },
    {
        $unwind: { path: "$image", preserveNullAndEmptyArrays: true },
    },
    {
        $project: {
            name: 1,
            _id: 1,
            image: { link: 1 }
        }
    },
    { $sort: { [sortByField]: parseInt(sortOrder) } },
    { $skip: (paged - 1) * pageSize },
    { $limit: parseInt(pageSize) },
    ], callback);
}
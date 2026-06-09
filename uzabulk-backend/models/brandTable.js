const mongoose = require('mongoose');

let BrandSchema = mongoose.Schema({
    name: { type: String, required: true },
    image: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
    status: { type: String, enum: ["active", "inactive", "archived"], default: "active" },
    date_created: { type: Date },
    date_created_utc: { type: Date },
    date_modified: { type: Date },
    date_modified_utc: { type: Date },
},
    {
        versionKey: false
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    }
);

const BrandTable = mongoose.model('Brand', BrandSchema);

// Add Brand
module.exports.addBrand = function (data, callback) {
    data.date_created_utc = new Date();
    BrandTable.create(data, callback);
}

// Update Brand
module.exports.updateBrand = function (data, callback) {
    var query = { _id: data._id };
    BrandTable.findOneAndUpdate(query, data, { upsert: true, new: true }, callback);
}

module.exports.updateStatusByIds = (data, update, callback) => {
    let query = { _id: { $in: data._id } }
    BrandTable.updateMany(query, update, { "new": true }, callback);
}

// Get Brand by id
module.exports.getBrandById = (id, callback) => {
    BrandTable.findById(id).populate('image').exec(callback);
}

// Get Brand by store id
module.exports.getBrandByStoreId = (id, callback) => {
    BrandTable.findOne({ vendor: id }).populate('image').exec(callback);
}

// Remove Brand
module.exports.removeBrand = (id, callback) => {
    let query = { _id: id };
    BrandTable.remove(query, callback);
}

// Get Brands with filter
module.exports.getBrandsWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    BrandTable.aggregate([
        { $match: obj },
        { $sort: { [sortByField]: parseInt(sortOrder) } },
        { $skip: (paged - 1) * pageSize },
        { $limit: parseInt(pageSize) },
    ], callback);
}


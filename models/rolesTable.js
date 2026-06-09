const mongoose = require('mongoose');

let RoleSchema = mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String },
    permissions: { type: Array, default: [] },
    status: { type: String, enum: ['active', 'inactive', 'archived'] },
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

const RoleTable = module.exports = mongoose.model('Role', RoleSchema);

//add Role
module.exports.addRole = function (data, callback) {
    data.date_created_utc = new Date();
    RoleTable.create(data, callback);
}

//update Role
module.exports.updateRole = function (data, callback) {
    var query = { _id: data._id };
    RoleTable.findOneAndUpdate(query, data, { upsert: true, new: true }, callback);
}

module.exports.updateStatusByIds = (data, update, callback) => {
    let query = { _id: { $in: data._id } }
    RoleTable.updateMany(query, update, { "new": true }, callback);
}

//get Role by id
module.exports.getRoleById = (id, callback) => {
    RoleTable.findById(id, callback);
}

//remove Role
module.exports.removeRole = (id, callback) => {
    let query = { _id: id };
    RoleTable.remove(query, callback);
}

module.exports.geRolesWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    RoleTable.aggregate([
        { $match: obj },
        { $sort: { [sortByField]: parseInt(sortOrder) } }, { $skip: (paged - 1) * pageSize },
        { $limit: parseInt(pageSize) },
    ], callback);
}
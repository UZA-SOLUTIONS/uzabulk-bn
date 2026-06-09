const mongoose = require('mongoose');

let TemplateSchema = mongoose.Schema({
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ["customers", "drivers", "vendors", "orders", "admin", "superadmin"] },
    title: { type: String },
    description: { type: String },
    subject: { type: String },
    body: { type: String },
    constant: { type: String },
    required: { type: Boolean },
    restrictions: { type: Array, default: [] },
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

const TemplateTable = module.exports = mongoose.model('Template', TemplateSchema);

//add Template
module.exports.addTemplate = function (data, callback) {
    data.date_created_utc = new Date();
    TemplateTable.create(data, callback);
}

//update Template
module.exports.updateTemplate = function (data, callback) {
    var query = { _id: data._id };
    TemplateTable.findOneAndUpdate(query, data, { new: true }, callback);
}
//get Templates async
module.exports.getTemplatesAsync = function (callback) {
    return TemplateTable.find(callback);
}

//get Template by id
module.exports.getTemplateById = (id, callback) => {
    TemplateTable.findById(id, callback);
}

//remove Template
module.exports.removeTemplate = (id, callback) => {
    let query = { _id: id };
    TemplateTable.remove(query, callback);
}

module.exports.getTemplatesWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    TemplateTable.aggregate([{ $match: obj },
    //{ $sort: { [sortByField]: parseInt(sortOrder) } },
    { $skip: (paged - 1) * pageSize },
    { $limit: parseInt(pageSize) },
    { $group: { _id: "$type", templates: { $push: "$$ROOT" } } },
    { $sort: { _id: 1 } }
    ], callback);
}
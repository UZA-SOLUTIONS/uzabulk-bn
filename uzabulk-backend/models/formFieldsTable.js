const mongoose = require('mongoose');
let slug = require('mongoose-slug-updater');
let { transliterate } = require('transliteration');
mongoose.plugin(slug);

let formFieldSchema = mongoose.Schema({
    template: { type: mongoose.Schema.Types.ObjectId, ref: 'documentTemplate' },
    type: { type: String, enum: ["text", "textarea", "select", "checkbox", "radio", "file", 'datePicker'], default: "text" },
    label: { type: String },
    name: { type: String, slug: "label", unique: true, lowercase: true, slugOn: { findOneAndUpdate: false } },
    validation: {
        required: { type: Boolean, default: false },
    },
    options: [{
        label: { type: String },
        value: { type: String }
    }],
    sortOrder: { type: Number, default: 1 },
    status: { type: String, enum: ["active", "inactive", "archived"], default: "active" },
    valueType: { type: String, enum: ["pricePerUnitTime", "basePrice", "pricePerUnitDisatance"] },
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

const formFieldTable = module.exports = mongoose.model('formField', formFieldSchema);

//add FormField
module.exports.addFormField = function (data, callback) {
    data.date_created_utc = new Date();
    formFieldTable.create(data, callback);
}


//update FormField
module.exports.updateFormField = function (data, callback) {
    var query = { _id: data._id };
    formFieldTable.findOneAndUpdate(query, data, { upsert: true, new: true }, callback);
}
//get FormFields async
module.exports.getFormFieldsAsync = function (callback) {
    return formFieldTable.find(callback);
}

//get FormField by id
module.exports.getFormFieldById = (id, callback) => {
    formFieldTable.findById(id, callback);
}

module.exports.getFormFieldsByTemplate = (template, callback) => {
    formFieldTable.find({ template: template, status: { $ne: "archived" } }, callback).sort({ sortOrder: 1 });
}

//remove FormField
module.exports.removeFormField = (id, callback) => {
    let query = { _id: id };
    formFieldTable.remove(query, callback);
}

module.exports.geFormFieldsWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    formFieldTable.aggregate([{ $match: obj },
    { $sort: { [sortByField]: parseInt(sortOrder) } },
    { $skip: (paged - 1) * pageSize },
    { $limit: parseInt(pageSize) },
    ], callback);
}

module.exports.getDriverFormFieldsWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    formFieldTable.aggregate([{ $match: obj },
    { $sort: { [sortByField]: parseInt(sortOrder) } },
    { $skip: (paged - 1) * pageSize },
    { $limit: parseInt(pageSize) },
    { $project: { name: 1, isComplete: 1 } }
    ], callback);
}
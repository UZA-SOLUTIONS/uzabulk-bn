const mongoose = require('mongoose');
let slug = require('mongoose-slug-updater');
let { transliterate } = require('transliteration');
mongoose.plugin(slug);

let documentTemplateSchema = mongoose.Schema({
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    name: { type: String, required: true },
    isComplete: { type: Boolean, default: false },
    slug: { type: String, slug: "name", unique: true, trim: true, },
    role: { type: String, enum: ["DRIVER", "VENDOR", "USER", "HOST"] },
    type: { type: String, enum: ["personalInfo", "vehicleInfo", "qualificationInfo"], default: "personalInfo" },
    fields: [{ type: mongoose.Schema.Types.ObjectId, ref: 'formField' }],
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

const documentTemplateTable = module.exports = mongoose.model('documentTemplate', documentTemplateSchema);

//add DocumentTemplate
module.exports.addDocumentTemplate = function (data, callback) {
    data.date_created_utc = new Date();
    documentTemplateTable.create(data, callback);
}

//update DocumentTemplate
module.exports.updateDocumentTemplate = function (data, callback) {
    var query = { _id: data._id };
    documentTemplateTable.findOneAndUpdate(query, data, { upsert: true, new: true }, callback);
}
//get DocumentTemplates async
module.exports.getDocumentTemplatesAsync = function (callback) {
    return documentTemplateTable.find(callback);
}

//get DocumentTemplate by id
module.exports.getDocumentTemplateById = (id, callback) => {
    documentTemplateTable.findById(id, callback);
}

module.exports.AddRefToFields = (data) => {
    var query = { _id: data.template };
    var ref = data.ref;
    documentTemplateTable.findOneAndUpdate(query, {
        $addToSet: {
            fields: ref
        }
    }, { new: true }, function (err, data) {
        if (err) {
            console.log(err);
        }
    });
}

module.exports.removeRefToFields = (data) => {
    var query = { _id: data.template };
    var ref = data.ref;
    documentTemplateTable.findOneAndUpdate(query, {
        $pull: {
            fields: ref
        }
    }, { new: true }, function (err, data) {
        if (err) {
            console.log(err);
        }
    });
}

//remove DocumentTemplate
module.exports.removeDocumentTemplate = (id, callback) => {
    let query = { _id: id };
    documentTemplateTable.remove(query, callback);
}

module.exports.geDocumentTemplatesWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    documentTemplateTable.aggregate([{ $match: obj },
    //{ $lookup: { from: 'formfields', localField: 'fields', foreignField: '_id', as: 'fields' } },
    { $sort: { [sortByField]: parseInt(sortOrder) } },
    { $skip: (paged - 1) * pageSize },
    { $limit: parseInt(pageSize) },
    { $project: { name: 1, role: 1, status: 1, isComplete: 1, type: 1, date_created_utc: 1, date_created: 1 } }
    ], callback);
}

module.exports.getDriverDocumentTemplatesWithFilter = function (obj, callback) {
    documentTemplateTable.aggregate([{ $match: obj },
    { $lookup: { from: 'formfields', let: { template: "$_id" }, pipeline: [{ $match: { '$expr': { '$eq': ['$template', '$$template'] }, status: "active" } }, { $sort: { sortOrder: 1 } }], as: "fields" } },
    { $project: { name: 1, type: 1, valueType: 1, fields: { _id: 1, validation: 1, type: 1, label: 1, name: 1, options: 1, valueType: 1, }, isComplete: 1 } },
    {
        $addFields: {
            "fields.value": ''
        }
    },
    ], callback);
}

module.exports.updateStatusByIds = (data, update, callback) => {
    let query = { _id: { $in: data._id } }
    documentTemplateTable.updateMany(query, update, { "new": true }, callback);
}
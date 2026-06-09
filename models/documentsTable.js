const mongoose = require('mongoose');
let slug = require('mongoose-slug-updater');
mongoose.plugin(slug);

let documentSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    complete: { type: Array, default: [] },
    values: { type: Array, default: [] },
    file_name: { type: String },
    file_id: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
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

const documentTable = module.exports = mongoose.model('document', documentSchema);

//add DocumentTemplate
module.exports.addDocumentTemplate = function (data, callback) {
    data.date_created_utc = new Date();
    documentTable.create(data, callback);
}


//update DocumentTemplate
module.exports.updateDocumentTemplate = function (data, callback) {
    var query = { _id: data._id };
    documentTable.findOneAndUpdate(query, data, { upsert: true, new: true }, callback);
}
//get DocumentTemplates async
module.exports.getDocumentTemplatesAsync = function (callback) {
    return documentTable.find(callback);
}

//get DocumentTemplate by id
module.exports.getDocumentTemplateById = (id, callback) => {
    documentTable.findById(id, callback);
}

//remove DocumentTemplate
module.exports.removeDocumentTemplate = (id, callback) => {
    let query = { _id: id };
    documentTable.remove(query, callback);
}

module.exports.geDocumentTemplatesWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    documentTable.aggregate([{ $match: obj },
    { $sort: { [sortByField]: parseInt(sortOrder) } },
    { $skip: (paged - 1) * pageSize },
    { $limit: parseInt(pageSize) },
    ], callback);
}

module.exports.getDriverDocumentTemplatesWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    documentTable.aggregate([{ $match: obj },
    { $sort: { [sortByField]: parseInt(sortOrder) } },
    { $skip: (paged - 1) * pageSize },
    { $limit: parseInt(pageSize) },
    { $project: { name: 1, isComplete: 1 } }
    ], callback);
}
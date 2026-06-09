const mongoose = require('mongoose');
const Config = require('../config/constants.json');

let fileSchema = new mongoose.Schema({
    type: { type: String, enum: Config.FILE_TYPE },
    link: { type: String, required: true },
    mimeType: { type: String },
    type: { type: String },
    date_created: { type: Date, default: new Date() },
    date_created_utc: { type: Date, default: new Date() },
    date_modified: { type: Date },
    date_modified_utc: { type: Date },
    meta_data: [
        {
            key: { type: String, enum: ['isCorrupted'] },
            value: { type: String, enum: ['yes', 'no'] }
        }
    ]
},
    {
        versionKey: false
    });

const FileTable = module.exports = mongoose.model('File', fileSchema);

//get all Files
module.exports.getAllFiles = function (callback) {
    FileTable.find({}, callback);
}

//add To File
module.exports.addFile = function (data, callback) {
    FileTable.create(data, callback);
}
//add To File
module.exports.addMultipleFile = function (data) {
    return FileTable.insertMany(data);
}

module.exports.updateFile = function (data, callback) {
    var query = { _id: data._id };
    FileTable.findOneAndUpdate(query, data, { upsert: true, new: true }, callback);
}

module.exports.getFileById = (id, callback) => {
    FileTable.findById(id, callback);
}

module.exports.getFileByIdAsync = (id, callback) => {
    return FileTable.findById(id, callback);
}

//remove File
module.exports.removeFile = (id, callback) => {
    var query = { _id: mongoose.Types.ObjectId(id) };
    FileTable.deleteOne(query, callback);
}

module.exports.updateStatusByIds = (data, update, callback) => {
    let query = { _id: { $in: data._id } }
    FileTable.updateMany(query, update, { "new": true }, callback);
}

module.exports.geFileWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    FileTable.aggregate([{ $match: obj },
    { $sort: { [sortByField]: parseInt(sortOrder) } },
    { $skip: (paged - 1) * pageSize },
    { $limit: parseInt(pageSize) },
    ], callback);
}
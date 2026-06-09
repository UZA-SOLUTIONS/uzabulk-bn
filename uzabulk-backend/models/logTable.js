const mongoose = require('mongoose');
const Config = require('../config/constants.json');

let LogSchema = mongoose.Schema({
    id: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String,enum:Config.LOG_TYPE },
    idType: { type: String,enum:Config.ID_TYPE },
    message: { type: String },
    notes: { type: String },

    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'compaign' },
    isLogCompleted: { type: Boolean },
    successCount: { type: String },
    failureCount: { type: String },
    totalCount: { type: String },
    analyticPercentage: { type: String },
    notProcessed: { type: String },

    status: { type: String,enum:['success','error'],default:'success' },
    date_created: { type: Date,default:new Date() },
    date_created_utc: { type: Date,default:new Date()  },
    date_modified_utc: { type: Date },

    meta_data: [
        { 
            key: { type: String }, //store_name
            value: { type: String } //store name
        }
    ]
},
    {
        versionKey: false // You should be aware of the outcome after set to false
    });

const LogTable = module.exports = mongoose.model('Log', LogSchema);

//add Log
module.exports.addLog = function (data, callback) {
    LogTable.create(data, callback);
}
module.exports.addLogAsync = async function (data) {
//    return LogTable.create(data);
   var query = { campaignId: data.campaignId };
   data.date_modified_utc =  new Date()
   return await LogTable.findOneAndUpdate(query, data, { upsert: true, new: true });
}

//update Log
module.exports.updateLog = function (data, callback) {
    var query = { _id: data._id };
    LogTable.findOneAndUpdate(query, data, { upsert: true, new: true }, callback);
}

//get Log by id
module.exports.getLogById = (id, callback) => {
    LogTable.findById(id, callback);
}

//remove Log
module.exports.removeLog = (id, callback) => {
    let query = { _id: id };
    LogTable.remove(query, callback);
}

module.exports.geLogWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    LogTable.aggregate([{ $match: obj },
    { $sort: { [sortByField]: parseInt(sortOrder) } },
    { $skip: (paged - 1) * pageSize },
    { $limit: parseInt(pageSize) },
    ], callback);
}
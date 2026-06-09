const mongoose = require('mongoose');

let TerminologySchema = mongoose.Schema({
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, enum: ["customers", "drivers", "vendors", "admin", "order", "trip"] },
    lang: { type: String, enum: env.terminologyLang, default: "en" },
    values: [{}],
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

const TerminologyTable = module.exports = mongoose.model('Terminology', TerminologySchema);

//add Terminology
module.exports.addTerminology = function (data, callback) {
    data.date_created_utc = new Date();
    TerminologyTable.create(data, callback);
}

//update Terminology
module.exports.updateTerminology = function (data, callback) {
    var query = { _id: data._id };
    TerminologyTable.findOneAndUpdate(query, data, { new: true }).populate('store', 'domain').exec(callback);
}
//get Terminologys async
module.exports.getTerminologysAsync = function (callback) {
    return TerminologyTable.find(callback);
}
//get Terminologys async
module.exports.getTerminologyByConditionAsync = function (condition, callback) {
    return TerminologyTable.findOne(condition).lean().exec(callback);
}
//get Terminology by id
module.exports.getTerminologyById = (id, callback) => {
    TerminologyTable.findById(id, callback);
}

//remove Terminology
module.exports.removeTerminology = (id, callback) => {
    let query = { _id: id };
    TerminologyTable.remove(query, callback);
}

module.exports.getTerminologysWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    TerminologyTable.aggregate([{ $match: obj },
    //{ $sort: { [sortByField]: parseInt(sortOrder) } },
    { $skip: (paged - 1) * pageSize },
    { $limit: parseInt(pageSize) },
    { $group: { _id: "$type", templates: { $push: "$$ROOT" } } },
    { $sort: { _id: 1 } }
    ], callback);
}
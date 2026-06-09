const mongoose = require('mongoose');

let FAQSchema = mongoose.Schema({
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    question: { type: String },
    answer: { type: String },
    type: { type: String, enum: ["customers", "drivers", "website"] },
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

const FAQTable = module.exports = mongoose.model('FAQ', FAQSchema);

//add FAQ
module.exports.addFAQ = function (data, callback) {
    data.date_created_utc = new Date();
    FAQTable.create(data, callback);
}

//update FAQ
module.exports.updateFAQ = function (data, callback) {
    var query = { _id: data._id };
    FAQTable.findOneAndUpdate(query, data, { upsert: true, new: true }, callback);
}

module.exports.updateStatusByIds = (data, update, callback) => {
    let query = { _id: { $in: data._id } }
    FAQTable.updateMany(query, update, { "new": true }, callback);
}

//get faqs async
module.exports.getFAQsAsync = function (callback) {
    return FAQTable.find(callback);
}

//get faq by id
module.exports.getFAQById = (id, callback) => {
    FAQTable.findById(id, callback);
}

//remove faq
module.exports.removeFAQ = (id, callback) => {
    let query = { _id: id };
    FAQTable.remove(query, callback);
}

module.exports.geFAQsWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    FAQTable.aggregate([{ $match: obj },
    { $sort: { [sortByField]: parseInt(sortOrder) } },
    { $skip: (paged - 1) * pageSize },
    { $limit: parseInt(pageSize) },
    ], callback);
}
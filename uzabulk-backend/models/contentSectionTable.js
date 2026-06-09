const mongoose = require("mongoose");
const Config = require("../config/constants.json");

let ContentSectionSchema = mongoose.Schema(
    {
        store: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },
        name: { type: String, enum: ['Homepage'], required: true },
        sections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Section' }],
        status: { type: String, enum: ["active", "inactive", "archived"], default: "active" },
        date_created: { type: Date },
        date_created_utc: { type: Date },
        date_modified: { type: Date },
        date_modified_utc: { type: Date }
    },
    {
        versionKey: false, // You should be aware of the outcome after set to false
    }
);

const ContentSection = (module.exports = mongoose.model("ContentSection", ContentSectionSchema));

//add ContentSection
module.exports.addContentSection = function (data, callback) {
    data.date_created_utc = new Date();
    ContentSection.create(data, callback);
}

//update ContentSection
module.exports.updateContentSection = function (data, callback) {
    var query = { _id: data._id };
    ContentSection.findOneAndUpdate(query, data, { upsert: true, new: true }, callback);
}
//get ContentSections async
module.exports.getContentSectionsAsync = function (callback) {
    return ContentSection.find(callback);
}

//get ContentSection by id
module.exports.getContentSectionById = (id, callback) => {
    ContentSection.findById(id, callback);
}

module.exports.AddRefToFields = (data) => {
    var query = { _id: data.contentSection };
    var ref = data.ref;
    ContentSection.findOneAndUpdate(query, {
        $addToSet: {
            sections: ref
        }
    }, { new: true }, function (err, data) {
        if (err) {
            console.log(err);
        }
    });
}

module.exports.removeRefToFields = (data) => {
    var query = { _id: data.contentSection };
    var ref = data.ref;
    ContentSection.findOneAndUpdate(query, {
        $pull: {
            sections: ref
        }
    }, { new: true }, function (err, data) {
        if (err) {
            console.log(err);
        }
    });
}

//remove ContentSection
module.exports.removeContentSection = (id, callback) => {
    let query = { _id: id };
    ContentSection.remove(query, callback);
}

module.exports.geContentSectionsWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    ContentSection.aggregate([{ $match: obj },
    //{ $lookup: { from: 'formfields', localField: 'fields', foreignField: '_id', as: 'fields' } },
    { $sort: { [sortByField]: parseInt(sortOrder) } },
    { $skip: (paged - 1) * pageSize },
    { $limit: parseInt(pageSize) },
    { $project: { name: 1, role: 1, status: 1, isComplete: 1 } }
    ], callback);
}

module.exports.getDriverContentSectionsWithFilter = function (obj, callback) {
    ContentSection.aggregate([{ $match: obj },
    { $lookup: { from: 'formfields', let: { template: "$_id" }, pipeline: [{ $match: { '$expr': { '$eq': ['$template', '$$template'] }, status: "active" } }, { $sort: { sortOrder: 1 } }], as: "fields" } },
    { $project: { name: 1, fields: { _id: 1, validation: 1, type: 1, label: 1, name: 1, options: 1 }, isComplete: 1 } }
    ], callback);
}

module.exports.updateStatusByIds = (data, update, callback) => {
    let query = { _id: { $in: data._id } }
    ContentSection.updateMany(query, update, { "new": true }, callback);
}
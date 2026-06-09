const mongoose = require('mongoose');
let slug = require('mongoose-slug-updater');
let { transliterate } = require('transliteration');
mongoose.plugin(slug);

let contentSchema = mongoose.Schema({
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deviceType: { type: String, enum: ["web", "mobile"], required: true },
    type: { type: String, enum: ["ABOUT_US", "HOMEPAGE", "PRIVACY_POLICY", "REFUND_POLICY", "TERMS_CONDITIONS", "RETAILER_TERMS_CONDITIONS", "CONTACT_US", "APP_BANNER", "DRIVERPAGE", "VENDORPAGE", "OTHER"], default: '' },
    title: { type: String },
    slug: { type: String, slug: "title", unique: true, lowercase: true, transform: v => transliterate(v) },
    sections: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Section' }],
    content: { type: String },
    customContent: { type: String },
    status: { type: String, enum: ["active", "inactive", "archived"], default: "active" },
    seoSettings: {
        title: { type: String, default: null },
        metaDescription: { type: String, default: null },
        metaKeywords: { type: String, default: null },
        facebook: {
            title: { type: String, default: null },
            description: { type: String, default: null },
            image: { type: String, default: null }
        },
        twitter: {
            title: { type: String, default: null },
            description: { type: String, default: null },
            image: { type: String, default: null },
            username: { type: String, default: null },
        }
    },
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

const ContentPagesTable = module.exports = mongoose.model('Content', contentSchema);

//add ContentPages
module.exports.addContentPages = function (data, callback) {
    data.date_created_utc = new Date();
    ContentPagesTable.create(data, callback);
}

//update ContentPages
module.exports.updateContentPages = function (data, callback) {
    var query = { _id: data._id };
    ContentPagesTable.findOneAndUpdate(query, data, { upsert: true, new: true }, callback);
}

module.exports.updateStatusByIds = (data, update, callback) => {
    let query = { _id: { $in: data._id } }
    ContentPagesTable.updateMany(query, update, { "new": true }, callback);
}

//get ContentPagess async
module.exports.getContentPagessAsync = function (callback) {
    return ContentPagesTable.find(callback);
}

//get ContentPages by id
module.exports.getContentPagesById = (id, callback) => {
    ContentPagesTable.findOne({ _id: id })
        .populate({ path: "sections", populate: { path: "banner multipleContent.banner" }, options: { 'sort': 'sortOrder' } })
        .exec(callback)
}
//get ContentPages by id
module.exports.getContentPagesByIdAsync = async (condition, project) => {
    return await ContentPagesTable.findOne(condition, project)
        .populate(
            {
                path: "sections",
                match: { status: "active" },
                select: "sortOrder type templateType multipleContent",
                populate: { path: "banner multipleContent.banner multipleContent.product multipleContent.vendor multipleContent.storeType multipleContent.storeType multipleContent.category" },
                options: { 'sort': 'sortOrder' }
            })
}

module.exports.getContentPagesByType = (data, callback) => {
    ContentPagesTable.findOne({ ...data, status: "active" })
        .populate({ path: "sections", populate: { path: "banner multipleContent.banner" }, options: { 'sort': 'sortOrder' } })
        .exec(callback)
}

//remove ContentPages
module.exports.removeContentPages = (id, callback) => {
    let query = { _id: id };
    ContentPagesTable.remove(query, callback);
}

module.exports.geContentPagessWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    ContentPagesTable.aggregate([{ $match: obj },
    { $sort: { [sortByField]: parseInt(sortOrder) } },
    { $skip: (paged - 1) * pageSize },
    { $limit: parseInt(pageSize) },
    ], callback);
}

module.exports.AddRefToFields = (data) => {
    var query = { _id: data.contentSection };
    var ref = data.ref;
    ContentPagesTable.findOneAndUpdate(query, {
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
    ContentPagesTable.findOneAndUpdate(query, {
        $pull: {
            sections: ref
        }
    }, { new: true }, function (err, data) {
        if (err) {
            console.log(err);
        }
    });
}
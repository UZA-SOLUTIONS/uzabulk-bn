const mongoose = require('mongoose');
let slug = require('mongoose-slug-updater');
mongoose.plugin(slug);

let SectionSchema = mongoose.Schema({
    contentSection: { type: mongoose.Schema.Types.ObjectId, ref: 'Content' },
    label: { type: String },
    type: { type: String, enum: ["form", "banner", "contentImage", "content", "feature", "testimonial", "gallery", "slider", "productBanner", "categoryBanner", "simpleBanner", "vendorsList", "promotion", "appcontent", "storecategories", "bestseller"], required: true },
    heading: { type: String },
    subHeading: { type: String },
    content: { type: String },
    imagePosition: { type: String, enum: ['Left', 'Right'] },
    searchOption: { type: Boolean },
    fullWidth: { type: Boolean },
    buttonText: { type: String },
    buttonLink: { type: String },
    backgroundColor: { type: String },
    templateType: { type: String },
    banner: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
    multipleContent: [{
        storeType: { type: mongoose.Schema.Types.ObjectId, ref: 'storeType' },
        vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        product: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
        category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
        redirectTo: { type: String, enum: ["product", "category", "none"] }, // for simple banner only
        heading: { type: String },
        subHeading: { type: String },
        content: { type: String },
        banner: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
        buttonText: { type: String },
        buttonLink: { type: String },
    }],
    sortOrder: { type: Number, default: 1 },
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

const SectionTable = module.exports = mongoose.model('Section', SectionSchema);

//add Section
module.exports.addSection = function (data, callback) {
    data.date_created_utc = new Date();
    data.sortOrder = 1;
    SectionTable.create(data, callback);
}

//update Section
module.exports.updateSection = function (data, callback) {
    var query = { _id: data._id };
    SectionTable.findOneAndUpdate(query, data, { new: true }, callback);
}
//get Sections async
module.exports.getSectionsAsync = function (callback) {
    return SectionTable.find(callback);
}

//get Section by id
module.exports.getSectionById = (id, callback) => {
    SectionTable.findById(id)
        .populate('banner multipleContent.banner multipleContent.product multipleContent.category multipleContent.vendor multipleContent.storeType')
        .exec(callback);
}

module.exports.getSectionsByTemplate = (template, callback) => {
    SectionTable.find({ contentSection: template, status: 'active' }, callback).sort({ sortOrder: 1 });
}

//remove Section
module.exports.removeSection = (id, callback) => {
    let query = { _id: id };
    SectionTable.remove(query, callback);
}

module.exports.geSectionsWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    SectionTable.aggregate([{ $match: obj },
    { $sort: { [sortByField]: parseInt(sortOrder) } },
    { $skip: (paged - 1) * pageSize },
    { $limit: parseInt(pageSize) },
    ], callback);
}

module.exports.getDriverSectionsWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    SectionTable.aggregate([{ $match: obj },
    { $sort: { [sortByField]: parseInt(sortOrder) } },
    { $skip: (paged - 1) * pageSize },
    { $limit: parseInt(pageSize) },
    { $project: { name: 1, isComplete: 1 } }
    ], callback);
}
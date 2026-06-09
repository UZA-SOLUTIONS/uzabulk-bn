var mongoose = require('mongoose');

var LanguageSchema = mongoose.Schema({
    languageName: { type: String, default: "", trim: true },
    languageNativeName: { type: String },
    localeCode: { type: String, trim: true },
    languageCode: { type: String, default: "", unique: true, trim: true, lowercase: true },
    flagUrl: { type: String, default: "none" },
    countryCode: { type: String },
    countryName: { type: String },
    currency: { type: Object },
    timezones: { type: Array },
    sortOrder: { type: Number },
    status: { type: String, enum: ["active", "inactive", "archived"], default: "active" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
},
    {
        versionKey: false // You should be aware of the outcome after set to false
    });

LanguageSchema.index({ languageName: 1, status: 1 }, { background: true });

const LanguageTable = module.exports = mongoose.model('Language', LanguageSchema);

//get all Languages
module.exports.getAllLanguages = function (callback) {
    LanguageTable.find({}, callback);
}

module.exports.getEnabledLanguages = (callback) => {
    LanguageTable.find({ status: "active" }, callback).sort({ sortOrder: 1 });
}

module.exports.getLanguageByLocaleCode = (localeCode, callback) => {
    return LanguageTable.findOne({ localeCode: localeCode }, callback);
}

module.exports.getLanguageByLanguageCode = (languageCode, callback) => {
    return LanguageTable.findOne({ languageCode: languageCode }, callback);
}

//add To Language
module.exports.addLanguage = function (data, callback) {
    LanguageTable.create(data, callback);
}

module.exports.getLanguageById = (id, callback) => {
    LanguageTable.findById(id, callback);
}

module.exports.getLanguageByIdAsync = (id, callback) => {
    return LanguageTable.findById(id, callback);
}

module.exports.updateLanguage = (data, callback) => {
    var query = { _id: data.languageId };
    LanguageTable.findOneAndUpdate(query, data, { "new": true }, callback);
}

//remove Language
module.exports.removeLanguage = (id, callback) => {
    var query = { _id: id };
    LanguageTable.remove(query, callback);
}
const mongoose = require('mongoose');
let slug = require('mongoose-slug-updater');
let { transliterate } = require('transliteration');
mongoose.plugin(slug);

let AttributeTerm = new mongoose.Schema({
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    image: { type: String },
    attribute: { type: mongoose.Schema.Types.ObjectId, ref: 'Attribute' },
    name: { type: String, required: true },
    slug: { type: String, slug: "name", lowercase: true, transform: v => transliterate(v) },
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

AttributeTerm.index({ attribute: 1, name: 1 }, { name: "migration", background: false });

const attributeTermTable = module.exports = mongoose.model('AttributeTerm', AttributeTerm);


//get attributes Term async
module.exports.getAttributesAsync = function (callback) {
    return attributeTermTable.find(callback);
}

//get attribute Term by id
module.exports.getAttributeTermById = (id) => {
    return attributeTermTable.findById(id).lean();
}
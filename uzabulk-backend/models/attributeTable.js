const mongoose = require('mongoose');
let slug = require('mongoose-slug-updater');
let { transliterate } = require('transliteration');
mongoose.plugin(slug);

let attributeSchema = new mongoose.Schema({
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    storeType: { type: mongoose.Schema.Types.ObjectId, ref: 'storeType' },
    name: { type: String, required: true },
    slug: { type: String, slug: "name", lowercase: true, transform: v => transliterate(v) },
    terms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AttributeTerm' }],
    status: { type: String, enum: ["active", "inactive", "archived"], default: "active" },
    date_created: { type: Date },
    date_created_utc: { type: Date },
    date_modified: { type: Date },
    date_modified_utc: { type: Date },
    externalAttrId: String,
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

attributeSchema.index({ externalAttrId: 1, name: 1, vendor: 1 }, { name: "migration", background: false });

const attributeTable = module.exports = mongoose.model('Attribute', attributeSchema);


//get attributes async
module.exports.getAttributesAsync = function (callback) {
    return attributeTable.find(callback);
}

//get attribute by id
module.exports.getAttributeById = (id) => {
    return attributeTable.findById(id).lean()
}


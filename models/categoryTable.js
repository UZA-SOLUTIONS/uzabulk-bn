const mongoose = require('mongoose');
let slug = require('mongoose-slug-updater');
const File = require("./fileTable")
mongoose.plugin(slug);
let categorySchema = new mongoose.Schema({
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    externalCatId: Number,
    catName: { type: String, required: true },
    slug: { type: String, slug: "catName", unique: true, lowercase: true },
    catDesc: { type: String },
    level: Number,
    catImage: String,
    isFeatured: { type: Boolean },
    parent: { type: String, default: "none" },
    subcategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    sortOrder: { type: Number, default: 1 },
    status: { type: String, enum: ["active", "inactive", "archived"], default: "active" },
    date_created: { type: Date, default: new Date() },
    date_created_utc: { type: Date, default: new Date() },
    date_modified: { type: Date, default: new Date() },
    date_modified_utc: { type: Date, default: new Date() },
    meta_data: [
        {
            key: { type: String },
            value: { type: String }
        }
    ]
},
    {
        versionKey: false
    });

categorySchema.index({ status: 1, level: 1, sortOrder: 1, parent: 1 }, { name: "base_line_filter" });
categorySchema.index({ externalCatId: 1 }, { name: "migration", background: false });
categorySchema.statics = {
    _find: function (query, select, sort = null) {
        return this.find(query, select).sort(sort).lean()
    },

    _list: function () {
        let projection = {
            catName: 1,
            subcategories: 1,
            catImage: 1
        };
        let imageLookup = [
            {
                $lookup: {
                    from: "files", localField: "catImage", foreignField: "_id", as: "catImage",
                }
            },
            { $unwind: { path: "$catImage", preserveNullAndEmptyArrays: true } }
        ];
        let lookup = {
            from: "categories",
            localField: "subcategories",
            foreignField: "_id",
            as: "subcategories",
        }
        return this.aggregate([
            { $match: { status: "active", parent: "none" } },
            { $project: projection },
            ...imageLookup,
            {
                $lookup: {
                    ...lookup,
                    pipeline: [
                        {
                            $lookup: {
                                ...lookup,
                                pipeline: [
                                    ...imageLookup,
                                    {
                                        $project: projection
                                    },
                                ]
                            }
                        },
                        {
                            $project: projection
                        },
                        ...imageLookup,
                    ]
                }
            }
        ]);
    },
    getExternalCategory: function (categoryIds) {
        return this.find({ externalCatId: { $in: categoryIds }, status: "active" });
    }
}
const categoryTable = module.exports = mongoose.model('Category', categorySchema);

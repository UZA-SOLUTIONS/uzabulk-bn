const mongoose = require("mongoose");

let schema = new mongoose.Schema(
    {
        search: String,
        count: { type: Number, default: 1 },
        created_at: { type: Date },
        updated_at: { type: Date },
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

schema.index({ search: 1 }, { name: "filter_for_update" });
schema.index({ count: -1, updated_at: -1 }, { name: "filter_for_get" });

schema.statics = {
    set: async function (search) {
        const hasRes = await this.findOne({ search: new RegExp(`^${search}`) });
        if (hasRes) {
            hasRes.count += 1;
            await hasRes.save();
        }
        else {
            await this.create({ search });
        }
    },

    get: function () {
        return this.find().sort({ count: -1, updated_at: -1 }).limit(5).lean().exec();
    },
}

const model = (module.exports = mongoose.model("FrequentlySearch", schema));
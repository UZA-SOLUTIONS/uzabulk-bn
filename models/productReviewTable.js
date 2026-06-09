var mongoose = require('mongoose');

var ReviewSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    product_id: { type: String, required: true },
    status: { type: String, enum: ["approved", "spam", "trash", "unapproved"], default: "approved" },
    reviewer: { type: String, required: true },
    reviewer_email: { type: String },
    review: { type: String },
    rating: { type: Number, default: 0 },
    createdAt: { type: Date },
    updatedAt: { type: Date }
},
    {
        versionKey: false // You should be aware of the outcome after set to false
    });

const ReviewTable = module.exports = mongoose.model('productReview', ReviewSchema);

module.exports.getReviews = function (callback) {
    ReviewTable.find({}, callback);
}

module.exports.getReviewsAsync = function (callback) {
    return ReviewTable.find({}, callback);
}

module.exports.addReview = function (data, callback) {
    data.status = "approved";
    data.createdAt = new Date();
    data.updatedAt = new Date();
    ReviewTable.create(data, callback);
}

module.exports.getReviewById = (id, callback) => {
    ReviewTable.findById(id, callback);
}

module.exports.getReviewByIdAsync = (id, callback) => {
    return ReviewTable.findById(id, callback);
}

module.exports.updateReview = (data, callback) => {
    var query = { _id: data.reviewId };
    data.updatedAt = new Date();
    ReviewTable.findOneAndUpdate(query, data, { "new": true }, callback);
}

//remove Review
module.exports.removeReview = (id, callback) => {
    var query = { _id: id };
    ReviewTable.remove(query, callback);
}
module.exports.getReviewList = (obj, sortByField, sortOrder, paged, pageSize, callback) => {
    ReviewTable.aggregate([
        {
            $addFields: {
                id: { $toObjectId: "$product_id" }
            }
        },
        {
            $lookup:
            {
                from: "products",
                localField: "id",
                foreignField: "_id",
                as: "products"
            }
        },
        {
            $unwind: "$products"
        },
        {
            $match: obj
        },
        { $project: { products: 0 } },
        { $sort: { [sortByField]: parseInt(sortOrder) } },
        { $skip: (paged - 1) * pageSize },
        { $limit: parseInt(pageSize) },
    ], callback);

}
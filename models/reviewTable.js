const mongoose = require('mongoose');

let ReviewSchema = mongoose.Schema({
    reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewed_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    review: { type: String },
    rating: { type: Number, default: 0 },
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

const ReviewTable = module.exports = mongoose.model('Review', ReviewSchema);


module.exports.getReviews = function (callback) {
    ReviewTable.find({}, callback);
}

module.exports.getReviewsAsync = function (callback) {
    return ReviewTable.find({}, callback);
}

module.exports.addReview = function (data, callback) {
    data.date_created_utc = new Date();
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
    ReviewTable.find(obj)
        .populate({
            path: "order",
            select: "customOrderId storeType",
            populate: {
                path: 'storeType',
                select: 'storeType'
            }
        })
        .populate({
            path: "reviewed_by", select: "name role profileImage",
            populate: {
                path: 'profileImage',
                select: 'link'
            }
        }).sort({ [sortByField]: parseInt(sortOrder) }).skip((paged - 1) * pageSize).limit(parseInt(pageSize))
        .exec(callback);
}
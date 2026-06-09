const category = require('../../../models/categoryTable');
const ObjectId = require('objectid');
let getCategories = (obj, sortByField, sortOrder, paged, pageSize, callback) => {
    return category.aggregate([
        { $match: obj },
        { $lookup: { from: 'categories', localField: 'subcategories', foreignField: '_id', as: 'subcategories' } },
        { $lookup: { from: 'files', localField: 'catImage', foreignField: '_id', as: 'catImage' } },
        {
            $unwind: { path: "$catImage", preserveNullAndEmptyArrays: true },
        },
        { $sort: { [sortByField]: parseInt(sortOrder) } }, { $skip: (paged - 1) * pageSize },
        { $limit: parseInt(pageSize) },
    ], callback);
};

let getCategoryById = (id, callback) => {
    category.findById(id).populate('catImage').exec(callback);
};
let list = (query) => {
    return category.find(query, "catName catDesc isFeatured")
        .populate('catImage', "link -_id")
        .lean()
};
let getCategoryList = (query) => {
    return category.find(query, "catName status sortOrder catDesc isFeatured")
        .populate({
            path: 'subcategories',
            match: { status: 'active' },
            options: { sort: { sortOrder: 1 } },
            select: "catName subcategories sortOrder catDesc"
        })
        .populate('catImage', "link -_id")
        .lean()
};
let uzaCategories = async () => {
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
    return category.aggregate([
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
}
let getUZACategories = (query) => {
    return category.find(query, "parent catName status sortOrder catDesc isFeatured subcategories")
        .populate('catImage', "link -_id")
        .sort({ sortOrder: 1 })
        .lean()
};
let countdata = async (query) => {
    return category.countDocuments(query);
};
let getSubCategory = async (_id) => {
    return category.findOne({ _id, status: "active" }, 'catName status sortOrder')
        .populate({ path: 'catImage', select: 'link -_id' })
        .populate({
            path: 'subcategories',
            match: { status: 'active' },
            options: { sort: { sortOrder: 1 } },
            select: 'catName status sortOrder',
            populate: { path: 'catImage', select: 'link -_id' }
        })
        .lean();
};
let sourceByApplicaton = async () => {
    let pipline = [
        { $match: { status: "active" } },
        {
            $lookup: {
                from: "products",
                let: { categoryId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $in: ["$$categoryId", "$categories"] },
                                    { $eq: ["$status", "active"] },
                                    { $eq: ["$adminSold", true] },
                                ]
                            }
                        }
                    },
                    { $limit: 1 }

                ],
                as: "products"
            }
        },
        { $match: { products: { $ne: [] } } },
        { $lookup: { from: 'files', localField: 'catImage', foreignField: '_id', as: 'catImage' } },
        attachUnwind('catImage'),
        {
            $project: {
                catName: 1,
                catDesc: 1,
                catImage: { link: 1 }
            }
        },
        { $limit: 10 }
    ];

    return category.aggregate(pipline);
}

function attachUnwind(key) {
    return {
        $unwind: {
            path: `$${key}`,
            preserveNullAndEmptyArrays: true
        },
    };
};
module.exports = {
    getCategories,
    uzaCategories,
    countdata,
    getCategoryById,
    getCategoryList,
    getSubCategory,
    list,
    sourceByApplicaton,
    getUZACategories
}
const mongoose = require('mongoose');
const Config = require('../config/constants.json');
const ObjectId = require('objectid');

let userSchema = mongoose.Schema({
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: env.storeId },
    storeType: [{ type: mongoose.Schema.Types.ObjectId, ref: 'storeType' }],
    geoFence: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Geofence' }],
    serviceId: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    name: { type: String },
    hintName: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    gender: { type: String, enum: ["MALE", "FEMALE", "OTHER", null], default: null },
    country: { type: String },
    city: { type: String },
    dob: { type: String },
    email: { type: String, lowercase: true, trim: true },
    mobileNumber: { type: String },
    countryCode: { type: String },
    altMobileNumber: { type: String },
    altCountryCode: { type: String },
    password: { type: String },
    isSignupDetailCompleted: { type: Boolean, default: false },
    isForgotPasswordRequested: { type: Boolean, default: false },
    isKycCompleted: { type: Boolean, default: false },
    salt: { type: String },
    address: { type: String },
    profileImage: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
    bannerImage: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
    OTP: { type: String },
    OTPexp: { type: Date },
    restToken: { type: String },
    role: { type: String, enum: Config.ROLES, default: env.ROLE },
    dType: { type: String, enum: ["TAXI", "PICKUPDROP", "OTHER"], default: 'OTHER' },
    businessType: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BusinessType' }],
    userLocation: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number] }
    },
    angle: { type: Number },
    loyaltyPoints: {
        points: { type: Number, default: 0 },
        value: { type: Number, default: 0 }
    },
    commisionType: { type: String, enum: ["global", "override"], default: "global" },
    commission:
    {
        vendor: { type: Number },
        deliveryBoy: { type: Number }
    },
    notifications: [
        {
            type: { type: String, enum: ["orderPlaced"], default: "orderPlaced" },
            values: [
                {
                    key: { type: String, enum: ["notification", "sms", "email"], default: "notification" },
                    value: { type: Boolean, default: true },
                    status: { type: String, enum: ["active", "inactive"], default: "active" }
                }
            ]
        }
    ],
    notificationSound: { type: String, default: null },
    wallet: { type: Number, default: 0 },
    documentsList: { type: Array },
    tip: { type: Array },
    taxAmount: { type: Number },
    isBankFieldsAdded: { type: Boolean, default: false },
    bankFields: [
        {
            label: { type: String },
            key: { type: String },
            value: { type: String }
        }
    ],
    avgRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    isVendorAvailable: { type: Boolean, default: false },
    vendorAvailability: { type: String, enum: ["always", "off", "day"], default: "always" },
    timeSlot: [
        {
            dayStatus: { type: String, enum: ["yes", "no"] },
            day: { type: Number },
            startTime: { type: String },
            endTime: { type: String }
        }
    ],
    deliveryTimeSlot: {
        status: { type: Boolean, default: false },
        startTime: { type: String },
        endTime: { type: String }
    },
    weekendDayDeliveryTimeSlot: {
        saturdaySlot: {
            status: { type: Boolean, default: false },
            startTime: { type: String },
            endTime: { type: String }
        },
        sundaySlot: {
            status: { type: Boolean, default: false },
            startTime: { type: String },
            endTime: { type: String }
        }
    },
    orderAutoApproval: { type: Boolean, default: false },
    orderAutoCancel: { type: Boolean, default: true },
    deliveryType: { type: Array },
    pricePerPerson: { type: Number },
    minOrderAmont: { type: Number },
    orderPreparationTime: { type: Number },
    driverassign: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    customerassign: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    vendorassign: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    preferredDriver: [
        {
            driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            storeType: { type: mongoose.Schema.Types.ObjectId, ref: 'storeType' }
        }
    ], //taxi customer's preferred driver
    accessLevel: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
    cuisines: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Cuisine' }],
    reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Review' }],
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
    status: { type: String, enum: ['created', 'approved', 'rejected', 'blocked', 'active', 'inactive', 'archived', 'temp'], default: 'active' },
    onlineStatus: { type: String, enum: ['online', 'pickupInroute', 'pickupArrived', 'destinationInroute', 'offline', 'watingForCabOrOrder', 'onPoolTrip'], default: "offline" },
    tokens: [
        {
            token: { type: String }
        }
    ],
    OTP: { type: Number },
    OTPexp: { type: Date },
    firebaseToken: { type: String, default: null },
    firebaseTokens: [
        {
            token: { type: String }
        }
    ],
    currentOrderId: { type: String, default: null },
    stripeConnect: {
        status: { type: Boolean, default: false },
        accountId: { type: String, default: null },
        login_link: { type: String, default: null },
        error: { type: String, default: null }
    },
    pay360Split: {
        status: { type: Boolean, default: false },
        accountId: { type: String, default: null },
        merchantId: { type: String, default: null }
    },
    facebook_id: { type: String, default: null },
    google_id: { type: String, default: null },
    apple_id: { type: String, default: null },
    isLoginFromSocial: { type: Boolean, default: false },
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
    referralCode: { type: String }, // for user
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // when user register from user's referral code
    referralUserCount: { type: Number },//no of user which has been signup with referral code.
    isPendingSignupProcess: { type: Boolean },
    enabledRideShare: { type: Boolean },
    isActivated: { type: Boolean, default: false },
    freeRideSetting: { status: Boolean, numOfRide: Number, remainFreeRide: Number },//added free ride feature for Tiakxi store
    language: {
        name: String,//English,French..
        code: String,//en,fr..
        flag: String //url...
    },
    isFoundFraud: { type: Boolean },
    brands: [{ type: mongoose.Schema.Types.ObjectId, ref: "Cuisine" }],
    fraud_found_date_utc: { type: Date },
    isTranpotationService: { type: Boolean, default: false },
    isDeliveryService: { type: Boolean, default: false },
    hostAddress: { type: String },
    setTripFareSetting: {
        status: { type: Boolean },
        basePrice: { type: Number },
        pricePerUnitDistance: { type: Number },
        pricePerUnitTimeMinute: { type: Number },
    },
    meta_data: [
        {
            key: { type: String },
            value: { type: String }
        }
    ],
    aboutUs: { type: String },
    website: { type: String },
    member: { type: Number },
    expireDate: { type: Date },
    brandName: { type: String }
},
    {
        versionKey: false // You should be aware of the outcome after set to false
    });

userSchema.index({ userLocation: "2dsphere" });

const User = module.exports = mongoose.model('User', userSchema);



module.exports.addUserByMobile = (data, callback) => {
    data.date_created_utc = new Date();
    data.isLoginFromSocial = false;
    let query = { store: data.store, mobileNumber: data.mobileNumber, role: data.role, status: { $ne: "archived" } };
    User.findOneAndUpdate(query, data, { "fields": { password: 0, salt: 0, firebaseToken: 0 }, upsert: true, "new": true }, callback);
}
module.exports.addUserHost = (data, callback) => {
    data.date_created_utc = new Date();
    data.isLoginFromSocial = false;
    let query = { _id: data.user, mobileNumber: data.mobileNumber, role: data.role, status: { $ne: "archived" } };
    User.findOneAndUpdate(query, data, { "fields": { password: 0, salt: 0, firebaseToken: 0 }, "new": true }, callback);
}

module.exports.addStaffByEmail = (data, callback) => {
    data.date_created_utc = new Date();
    let query = { store: data.store, email: data.email, role: data.role };
    User.findOneAndUpdate(query, data, { "fields": { password: 0, salt: 0, firebaseToken: 0 }, upsert: true, "new": true }, callback);
}

module.exports.addUserByEmail = (data, callback) => {
    data.date_created_utc = new Date();
    data.isBankFieldsAdded = false;
    data.orderAutoApproval = false;
    data.status = data.status ? data.status : "created";
    let query = { storeType: data.storeType, email: data.email, role: data.role, status: data.status };
    User.findOneAndUpdate(query, data, { "fields": { password: 0, salt: 0, tokens: 0, firebaseToken: 0 }, upsert: true, "new": true }, callback);
}

module.exports.addDriverByEmail = (data, callback) => {
    data.date_created_utc = new Date();
    data.status = data.status ? data.status : "created";
    data.isBankFieldsAdded = false;
    let query = { store: data.store, email: data.email, role: data.role, status: data.status };
    User.findOneAndUpdate(query, data, { "fields": { password: 0, salt: 0, tokens: 0, firebaseToken: 0 }, upsert: true, "new": true }, callback);
}

module.exports.addUserAdminByEmail = (data, callback) => {
    data.date_created_utc = new Date();
    data.isBankFieldsAdded = false;
    let query = { email: data.email, role: data.role };
    User.findOneAndUpdate(query, data, { "fields": { password: 0, salt: 0, tokens: 0, firebaseToken: 0 }, upsert: true, "new": true }, callback);
}

module.exports.getUserByIdForDeliveryBoy = (id, callback) => {
    User.findById(id)
        .populate(
            {
                path: "vehicle",
                populate: {
                    path: "vehicleType",
                    select: "name image vehicle type",

                    populate: [
                        {
                            path: 'image',
                            select: 'link'
                        },
                        {
                            path: 'icon',
                            select: 'link'
                        }
                    ],
                }
            }
        )
        .populate({ path: "store", select: 'commissionTransfer storeType codWalletLimit referredUserCommission' })
        .populate({ path: "profileImage" })
        .exec(callback);
}
module.exports.getUserBystoreId = (id, callback) => {
    User.findOne(id)
        .populate({ path: "preferredDriver" })
        .populate({ path: "accessLevel" })
        .populate({ path: "store" })
        .populate({ path: "profileImage" })
        .populate({ path: "storeType", select: 'storeType' })
        .populate({ path: "driverassign", select: "name" })
        .populate({ path: "customerassign", select: "name" })
        .populate({ path: "vendorassign", select: "name" })
        .populate(
            {
                path: "reviews",
                populate: [
                    {
                        path: "order",
                        select: "customOrderId storeType",
                        populate: {
                            path: 'storeType',
                            select: 'storeType'
                        }
                    },
                    {
                        path: "reviewed_by",
                        select: "name role profileImage",
                        populate: {
                            path: 'profileImage',
                            select: 'link'
                        }
                    }
                ],
                options: {
                    limit: 50,
                    sort: { date_created_utc: -1 }
                }
            }
        )
        .exec(callback);
}

module.exports.getUserById = (id, callback) => {
    User.findById(id)
        .populate({ path: "preferredDriver" })
        .populate({ path: "accessLevel" })
        .populate({ path: "store" })
        .populate({ path: "profileImage" })
        .populate({ path: "storeType", select: 'storeType' })
        .populate(
            {
                path: "reviews",
                populate: [
                    {
                        path: "order",
                        select: "customOrderId storeType",
                        populate: {
                            path: 'storeType',
                            select: 'storeType'
                        }
                    },
                    {
                        path: "reviewed_by",
                        select: "name role profileImage",
                        populate: {
                            path: 'profileImage',
                            select: 'link'
                        }
                    }
                ],
                options: {
                    limit: 50,
                    sort: { date_created_utc: -1 }
                }
            }
        )
        .exec(callback);
}

module.exports.getUserByIdForVendor = (id, callback) => {
    User.findById(id)
        .populate({ path: "preferredDriver" })
        .populate({ path: "accessLevel" })
        .populate({ path: "bannerImage" })
        .populate({ path: "profileImage" })
        .populate({ path: "storeType", select: 'storeType' })
        .exec(callback);
}
module.exports.getUserByStoreIdForRestaurant = (id, callback) => {
    User.findOne(id)
        .populate({ path: "geoFence" })
        .populate({ path: "preferredDriver" })
        .populate({ path: "accessLevel" })
        .populate({ path: "profileImage" })
        .populate({ path: "bannerImage" })
        .populate({ path: "cuisines", select: 'name' })
        .populate({ path: "businessType", select: 'name' })
        .populate(
            {
                path: "reviews",
                populate: [
                    {
                        path: "order",
                        select: "customOrderId storeType",
                        populate: {
                            path: 'storeType',
                            select: 'storeType'
                        }
                    },
                    {
                        path: "reviewed_by",
                        select: "name role profileImage",
                        populate: {
                            path: 'profileImage',
                            select: 'link'
                        }
                    }
                ],
                options: {
                    limit: 10,
                    sort: { date_created_utc: -1 }
                }
            }
        )
        .populate({ path: "storeType", select: 'storeType commission taxSettings isEnableDeliveryTimeSlot' })
        .exec(callback);
}

module.exports.getUserByIdForRestaurant = (id, callback) => {
    User.findById(id)
        .populate({ path: "preferredDriver" })
        .populate({ path: "accessLevel" })
        .populate({ path: "profileImage" })
        .populate({ path: "bannerImage" })
        .populate({ path: "cuisines", select: 'name' })
        .populate(
            {
                path: "reviews",
                populate: [
                    {
                        path: "order",
                        select: "customOrderId storeType",
                        populate: {
                            path: 'storeType',
                            select: 'storeType'
                        }
                    },
                    {
                        path: "reviewed_by",
                        select: "name role profileImage",
                        populate: {
                            path: 'profileImage',
                            select: 'link'
                        }
                    }
                ],
                options: {
                    limit: 50,
                    sort: { date_created_utc: -1 }
                }
            }
        )
        .populate({ path: "storeType", select: 'storeType commission taxSettings' })
        .exec(callback);
}

module.exports.getUserByIdForStore = (id, callback) => {
    User.findById(id)
        .populate({ path: "preferredDriver" })
        .populate({ path: "profileImage" })
        .populate({ path: "bannerImage" })
        .populate({ path: "accessLevel", match: { status: "active" } })
        .populate({ path: "storeType", select: 'storeType' })
        .exec(callback);
}

module.exports.getUserByIds = (ids, callback) => {
    User.find({ _id: { $in: ids } }, 'firebaseToken onlineStatus angle userLocation', callback);
}

module.exports.getUserByIdAsync = (id, callback) => {
    return User.findById(id)
        .populate({ path: 'geoFence', match: { status: "active" } })
        .populate({ path: "preferredDriver" })
        .populate({ path: "cuisines", select: 'name' })
        .populate({ path: "profileImage" })
        .populate({ path: "bannerImage" })
        .populate({ path: "storeType" })
        .populate({ path: "store", populate: [{ path: "plan.billingPlan" }, { path: 'cardDetails', select: { last4digit: 1, type: 1 } }] })
        .exec(callback);
}

// module.exports.updateToken = async (data, callback) => {
//     let query = { _id: data._id };
//     let update = {
//         tokens: data.tokens
//     }

//     if (data.firebaseToken) {
//         update.firebaseToken = data.firebaseToken;
//     }

//     if (data.firebaseTokens) {
//         update.firebaseTokens = data.firebaseTokens;
//     }
//     let projection = {
//         // password: 0, salt: 0, tokens: 0 ,
//         _id: 1, firstName: 1, lastName: 1, email: 1, countryCode: 1, mobileNumber: 1,
//     }
//     let response = await User.findOneAndUpdate(query, update, { "fields": projection, "new": true }).lean();
//     // .populate({ path: "storeType" })
//     // .populate({ path: "accessLevel" })
//     // .populate({ path: "store" })
//     // .populate({ path: "profileImage" })
//     // .exec(callback);
//     return response;
// }
module.exports.updateToken = (data, callback) => {
    let query = { _id: data._id };
    let update = {
        tokens: data.tokens
    }

    if (data.firebaseToken) {
        update.firebaseToken = data.firebaseToken;
    }

    if (data.firebaseTokens) {
        update.firebaseTokens = data.firebaseTokens;
    }

    User.findOneAndUpdate(query, update, { "fields": { password: 0, salt: 0, tokens: 0 }, "new": true })
        .populate({ path: "storeType" })
        .populate({ path: "accessLevel" })
        .populate({ path: "store" })
        .populate({ path: "profileImage" })
        .exec(callback);
}

module.exports.updateTokenDeliveryBoy = (data, callback) => {
    let query = { _id: data._id };
    let update = {
        tokens: data.tokens
    }

    if (data.firebaseToken) {
        update.firebaseToken = data.firebaseToken;
    }

    if (data.firebaseTokens) {
        update.firebaseTokens = data.firebaseTokens;
    }

    User.findOneAndUpdate(query, update, { "fields": { password: 0, salt: 0, tokens: 0 }, "new": true })
        .populate(
            {
                path: "vehicle",
                populate: {
                    path: "vehicleType",
                    select: "name image",
                    populate: {
                        path: 'image',
                        select: 'link'
                    }
                }
            })
        .populate({ path: "store", select: 'commissionTransfer codWalletLimit' })
        .populate({ path: "profileImage" })
        .exec(callback);
}

module.exports.updateProfileDeliveryBoy = (data, callback) => {
    let query = { _id: data._id };

    User.findOneAndUpdate(query, data, { "fields": { password: 0, salt: 0, tokens: 0 }, "new": true })
        .populate(
            {
                path: "vehicle",
                populate: {
                    path: "vehicleType",
                    select: "name image vehicle type",
                    populate: [
                        {
                            path: 'image',
                            select: 'link'
                        },
                        {
                            path: 'icon',
                            select: 'link'
                        }
                    ]
                }
            })
        .populate({ path: "store", select: 'commissionTransfer' })
        .populate({ path: "profileImage" })
        .exec(callback);
}

module.exports.updateFirebaseToken = (data, callback) => {
    let query = { _id: data._id };
    let update = {
        firebaseTokens: data.firebaseTokens,
        firebaseToken: data.firebaseToken
    }

    User.findOneAndUpdate(query, update, { "fields": { password: 0, salt: 0, tokens: 0 }, "new": true })
        .exec(callback);
}

module.exports.updateOTP = (data, callback) => {
    let query = { _id: data._id };
    let update = {
        OTP: data.OTP,
        OTPexp: data.OTPexp,
        date_modified_utc: new Date()
    }
    if (data.isForgotPasswordRequested) update.isForgotPasswordRequested = data.isForgotPasswordRequested;
    User.findOneAndUpdate(query, update, { "fields": { OTP: 1 }, "new": true }, callback);
}

module.exports.updatePassword = (data, callback) => {
    let query = { _id: data._id };
    let update = {
        isForgotPasswordRequested: false,
        password: data.password,
        salt: data.salt,
        date_modified_utc: new Date()
    }
    return User.findOneAndUpdate(query, update, { "fields": { password: 0, salt: 0, tokens: 0 }, "new": true }, callback);
}

module.exports.approveUser = (data, callback) => {
    let query = { email: data.email }
    let update = {
        status: data.status,
        date_modified_utc: new Date()
    }
    User.findOneAndUpdate(query, update, { "fields": { password: 0, salt: 0, tokens: 0 }, "new": true }, callback);
}

module.exports.updateUserStatus = (data, callback) => {
    let query = { _id: data._id }
    let update = {
        status: data.status,
        date_modified_utc: new Date()
    }
    User.findOneAndUpdate(query, update, { "fields": { password: 0, salt: 0, tokens: 0 }, "new": true }, callback);
}

module.exports.updateUserProfile = (data, callback) => {
    let query = { _id: data._id }
    User.findOneAndUpdate(query, data, { "fields": { password: 0, salt: 0, tokens: 0 }, "new": true })
        .populate({ path: 'geoFence', match: { status: "active" } })
        .populate({ path: "profileImage" })
        .populate({ path: "bannerImage" })
        .populate({ path: "storeType" })
        .populate({ path: "store" })
        .populate({ path: "cuisines" })
        .populate({ path: "businessType" })
        .populate(
            {
                path: "vehicle",
                populate: {
                    path: "vehicleType",
                    select: "name image vehicle type",
                    populate: {
                        path: 'image',
                        select: 'link'
                    }
                }
            }
        )

        .exec(callback);;
}

module.exports.updateAccountDetails = (data, callback) => {
    let query = { _id: data._id };
    let update = {
        bankFields: data.bankFields,
        isBankFieldsAdded: true
    }
    User.findOneAndUpdate(query, update, { "fields": { password: 0, salt: 0, tokens: 0 }, "new": true })
        .populate({ path: "profileImage" })
        .populate({ path: "storeType" })
        .populate({ path: "store" })
        .exec(callback);
}

module.exports.updateUserProfileByIds = (data, update, callback) => {
    let query = { _id: { $in: data._id } }
    if (update.onlineStatus) {
        query["$or"] = [{ onlineStatus: "online" }, { onlineStatus: "offline" }];


    };
    User.updateMany(query, update, { "fields": { password: 0, salt: 0, tokens: 0 }, "new": true }, callback);
}

module.exports.removeUser = (id, callback) => {
    var query = { _id: id };
    User.remove(query, callback);
}

module.exports.getUsersWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, is_demo, callback) {
    User.aggregate([
        { $match: obj },
        {
            $addFields: {
                encodemail: { $cond: [is_demo, { $cond: [{ $and: ["$email", { $ne: ["$email", null] }, { $ne: ["$email", ""] }] }, { $substr: ["$email", { $subtract: [{ $strLenCP: "$email" }, 5] }, 5] }, "***"] }, ""] },
                encodphone: { $cond: [is_demo, { $cond: [{ $and: ["$mobileNumber", { $ne: ["$mobileNumber", null] }, { $ne: ["$mobileNumber", ""] }] }, { $substrCP: ["$mobileNumber", { $subtract: [{ $strLenCP: "$mobileNumber" }, 2] }, 2] }, "***"] }, ""] }
            }
        },
        { $lookup: { from: 'roles', localField: 'accessLevel', foreignField: '_id', as: 'accessLevel' } },
        { $sort: { [sortByField]: parseInt(sortOrder) } },
        { $skip: (paged - 1) * pageSize },
        { $limit: parseInt(pageSize) },
        { $unwind: { path: "$accessLevel", preserveNullAndEmptyArrays: true } },
        { $project: { name: 1, email: { $cond: [is_demo, { $concat: ["******", "$encodemail"] }, "$email"] }, countryCode: 1, mobileNumber: { $cond: [is_demo, { $concat: ["******", "$encodphone"] }, "$mobileNumber"] }, status: 1, isFoundFraud: 1, onlineStatus: 1, bankFields: 1, wallet: 1, role: 1, date_created_utc: 1, accessLevel: { name: 1 } } }
    ], callback);
}
module.exports.getUsersWithFilterVendorDriver = function (obj, sortByField, sortOrder, paged, pageSize, is_demo, callback) {
    User.aggregate([
        { $match: obj },
        {
            $addFields: {
                encodemail: { $cond: [is_demo, { $cond: [{ $and: ["$email", { $ne: ["$email", null] }, { $ne: ["$email", ""] }] }, { $substr: ["$email", { $subtract: [{ $strLenCP: "$email" }, 5] }, 5] }, "***"] }, ""] },
                encodphone: { $cond: [is_demo, { $cond: [{ $and: ["$mobileNumber", { $ne: ["$mobileNumber", null] }, { $ne: ["$mobileNumber", ""] }] }, { $substrCP: ["$mobileNumber", { $subtract: [{ $strLenCP: "$mobileNumber" }, 2] }, 2] }, "***"] }, ""] }
            }
        },
        { $lookup: { from: 'roles', localField: 'accessLevel', foreignField: '_id', as: 'accessLevel' } },
        { $sort: { [sortByField]: parseInt(sortOrder) } },
        { $lookup: { from: 'storetypes', localField: 'storeType', foreignField: '_id', as: 'storeTypedata' } },
        {
            $unwind:
            {
                path: "$storeTypedata",
                preserveNullAndEmptyArrays: true
            }
        },
        { $skip: (paged - 1) * pageSize },
        { $limit: parseInt(pageSize) },
        { $unwind: { path: "$accessLevel", preserveNullAndEmptyArrays: true } },
        { $project: { name: 1, email: { $cond: [is_demo, { $concat: ["******", "$encodemail"] }, "$email"] }, countryCode: 1, mobileNumber: { $cond: [is_demo, { $concat: ["******", "$encodphone"] }, "$mobileNumber"] }, status: 1, onlineStatus: 1, bankFields: 1, wallet: 1, role: 1, storeTypeName: "$storeTypedata.storeType", date_created_utc: 1, accessLevel: { name: 1 } } }
    ], callback);
}

module.exports.getStoreWithFilter = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    User.aggregate([
        { $match: obj },
        { $lookup: { from: 'roles', localField: 'accessLevel', foreignField: '_id', as: 'accessLevel' } },
        { $lookup: { from: 'stores', localField: 'store', foreignField: '_id', as: 'store' } },
        { $sort: { [sortByField]: parseInt(sortOrder) } },
        { $skip: (paged - 1) * pageSize },
        { $limit: parseInt(pageSize) },
        { $unwind: { path: "$accessLevel", preserveNullAndEmptyArrays: true } },
        { $project: { name: 1, email: 1, countryCode: 1, mobileNumber: 1, status: 1, bankFields: 1, wallet: 1, date_created_utc: 1, accessLevel: { name: 1 }, store: { storeName: 1, plan: 1, status: 1 } } },
        { $unwind: { path: "$store", preserveNullAndEmptyArrays: true } },
    ], callback);
}

module.exports.updateReviewDetails = (data, callback) => {
    let query = { _id: data._id }
    let update = {
        $push: {
            reviews: data.reviewId
        },
        avgRating: data.avgRating,
        reviewCount: data.reviewCount
    }
    User.findOneAndUpdate(query, update, { new: true }, callback);
}
module.exports.getProductsListServiceProvider = (
    obj,
    pageSize,
    sortByField,
    sortOrder,
    paged,
    storeId,
    source,
    maxDistance,
    callback
) => {
    User.aggregate([
        {
            "$geoNear": {
                "near": source,
                "distanceField": "distance",
                "key": "userLocation",
                "spherical": true,
                "maxDistance": maxDistance,
                "query": { store: storeId, role: "DRIVER" }
            }
        },
        { $addFields: { service: { $cond: { if: "$serviceId", then: "$serviceId", else: [] } } } },
        {
            $lookup: {

                from: "products",
                let: { id: "$service", stypeId: obj.storeType, rating: "$avgRating" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: ["$status", "active"]
                                    },
                                    {
                                        $eq: ["$storeType", "$$stypeId"]
                                    }
                                ]
                            }
                        }
                    },
                    {
                        $addFields: {
                            isAvalibale: { $cond: { if: { $in: ["$_id", "$$id"] }, then: true, else: false } }


                        }
                    },
                    {
                        $set: {
                            average_rating: { $cond: { if: { $in: ["$_id", "$$id"] }, then: { $cond: ["$$rating", "$$rating", 0] }, else: 0 } }
                        }
                    },
                    {
                        $lookup: {

                            from: "categories",
                            let: { cat: "$categories" },
                            pipeline: [
                                {
                                    $match:
                                    {
                                        $expr:
                                        {
                                            $and:
                                                [
                                                    { $in: ["$_id", "$$cat"] }
                                                ]
                                        }
                                    }
                                },
                            ],
                            as: "category"
                        }

                    },
                    {
                        $lookup: {

                            from: "addons",
                            let: { addon: "$addons" },
                            pipeline: [
                                {
                                    $match:
                                    {
                                        $expr:
                                        {
                                            $and:
                                                [
                                                    { $in: ["$_id", "$$addon"] },
                                                    { $eq: ["$status", "active"] }
                                                ]
                                        }
                                    }
                                },
                            ],
                            as: "addons"
                        }

                    },
                    {
                        $lookup: {
                            from: "files",
                            localField: "featured_image",
                            foreignField: "_id",
                            as: "featur_img",
                        }
                    },
                    {
                        $unwind: { path: "$featur_img", preserveNullAndEmptyArrays: true }
                    },
                ],
                as: "data"
            }
        },
        {
            $unwind: "$data"
        },
        { $project: { data: 1 } },
        {
            $group: {
                _id: "$data._id", userData: { $first: "$data" },

            }
        },
        { $replaceRoot: { newRoot: "$userData" } },
        {
            $set: {
                featured_image: {
                    $cond: [
                        { $or: [{ $eq: [null, "$featured_image"] }, { $eq: ["", "$featured_image"] }] },
                        null,
                        "$featur_img"
                    ]
                }
            }
        },
        { $unset: "featur_img" },
        { $match: obj },
        { $skip: (paged - 1) * pageSize },
        { $limit: parseInt(pageSize) },
        { $sort: { [sortByField]: parseInt(sortOrder) } }
    ],
        callback
    )
}

module.exports.getProductsListVendor = (
    obj,
    pageSize,
    sortByField,
    sortOrder,
    paged,
    storeId,
    source,
    maxDistance,
    callback
) => {
    User.aggregate([
        {
            "$geoNear": {
                "near": source,
                "distanceField": "distance",
                "key": "userLocation",
                "spherical": true,
                "maxDistance": maxDistance,
                "query": { store: storeId, storeType: obj.storeType, role: "VENDOR", status: "approved" }
            }
        },
        {
            $lookup: {

                from: "products",
                let: { id: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: ["$vendor", "$$id"]
                                    },
                                    {
                                        $eq: ["$status", "active"]
                                    }
                                ]
                            }
                        }
                    },
                    { $addFields: { brandId: "$brand" } },

                    {
                        $lookup: {

                            from: "addons",
                            let: { addon: "$addons" },
                            pipeline: [
                                {
                                    $match:
                                    {
                                        $expr:
                                        {
                                            $and:
                                                [
                                                    { $in: ["$_id", "$$addon"] },
                                                    { $eq: ["$status", "active"] }
                                                ]
                                        }
                                    }
                                },
                                {
                                    $lookup: {
                                        from: "files",
                                        localField: "image",
                                        foreignField: "_id",
                                        as: "image",
                                    }
                                },
                                {
                                    $unwind: { path: "$image" }
                                },
                            ],
                            as: "addons"
                        }

                    },
                    {
                        $lookup: {

                            from: "cuisines",
                            let: { brand: "$brand" },
                            pipeline: [
                                {
                                    $match:
                                    {
                                        $expr:
                                        {
                                            $and:
                                                [
                                                    { $eq: ["$_id", "$$brand"] },
                                                    { $eq: ["$status", "active"] }
                                                ]
                                        }
                                    }
                                },
                            ],
                            as: "brand"
                        }

                    },
                    {
                        $lookup: {
                            from: "files",
                            localField: "featured_image",
                            foreignField: "_id",
                            as: "featur_img",
                        }
                    },
                    {
                        $unwind: { path: "$featur_img", preserveNullAndEmptyArrays: true }
                    },
                    {
                        $lookup: {
                            from: "files",
                            localField: "images",
                            foreignField: "_id",
                            as: "images",
                        }
                    },
                    {
                        $lookup: {

                            from: "users",
                            let: { vendor: "$vendor" },
                            pipeline: [
                                {
                                    $match:
                                    {
                                        $expr:
                                        {
                                            $and:
                                                [
                                                    { $eq: ["$_id", "$$vendor"] },
                                                ]
                                        }
                                    }
                                },
                                { "$project": { "userLocation": 1, "name": 1, "address": 1 } }
                            ],
                            as: "vendor"
                        }

                    },
                    {
                        $unwind: { path: "$brand" }
                    },
                    {
                        $unwind: { path: "$vendor" }
                    },
                    { "$project": { "seoSettings": 0, "veganType": 0 } }
                ],
                as: "data"
            }
        },
        {
            $unwind: "$data"
        },
        { $project: { data: 1 } },
        {
            $group: {
                _id: "$data._id", userData: { $first: "$data" },

            }
        },
        { $replaceRoot: { newRoot: "$userData" } },
        {
            $set: {
                featured_image: {
                    $cond: [
                        { $or: [{ $eq: [null, "$featured_image"] }, { $eq: ["", "$featured_image"] }] },
                        null,
                        "$featur_img"
                    ]
                }
            }
        },
        { $unset: "featur_img" },

        { $match: obj },
        { $skip: (paged - 1) * pageSize },
        { $limit: parseInt(pageSize) },
        { $sort: { [sortByField]: parseInt(sortOrder) } }
    ],
        callback
    )
}

module.exports.getProductsListVendorForAirbnb = (
    obj,
    pageSize,
    sortByField,
    sortOrder,
    paged,
    storeId,
    source,
    maxDistance,
    callback
) => {
    User.aggregate([
        {
            "$geoNear": {
                "near": source,
                "distanceField": "distance",
                "key": "userLocation",
                "spherical": true,
                "maxDistance": maxDistance,
                "query": { store: storeId, role: "VENDOR", status: "approved" }
            }
        },
        {
            $lookup: {

                from: "products",
                let: { id: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: ["$vendor", "$$id"]
                                    },
                                    {
                                        $eq: ["$status", "active"]
                                    }
                                ]
                            }
                        }
                    },
                    { $addFields: { brandId: "$brand" } },

                    {
                        $lookup: {

                            from: "addons",
                            let: { addon: "$addons" },
                            pipeline: [
                                {
                                    $match:
                                    {
                                        $expr:
                                        {
                                            $and:
                                                [
                                                    { $in: ["$_id", "$$addon"] },
                                                    { $eq: ["$status", "active"] }
                                                ]
                                        }
                                    }
                                },
                                {
                                    $lookup: {
                                        from: "files",
                                        localField: "image",
                                        foreignField: "_id",
                                        as: "image",
                                    }
                                },
                                {
                                    $unwind: { path: "$image" }
                                },
                            ],
                            as: "addons"
                        }

                    },
                    {
                        $lookup: {

                            from: "cuisines",
                            let: { brand: "$brand" },
                            pipeline: [
                                {
                                    $match:
                                    {
                                        $expr:
                                        {
                                            $and:
                                                [
                                                    { $eq: ["$_id", "$$brand"] },
                                                    { $eq: ["$status", "active"] }
                                                ]
                                        }
                                    }
                                },
                            ],
                            as: "brand"
                        }

                    },
                    {
                        $lookup: {
                            from: "files",
                            localField: "featured_image",
                            foreignField: "_id",
                            as: "featur_img",
                        }
                    },
                    {
                        $unwind: { path: "$featur_img", preserveNullAndEmptyArrays: true }
                    },
                    {
                        $lookup: {
                            from: "files",
                            localField: "images",
                            foreignField: "_id",
                            as: "images",
                        }
                    },
                    {
                        $lookup: {

                            from: "users",
                            let: { vendor: "$vendor" },
                            pipeline: [
                                {
                                    $match:
                                    {
                                        $expr:
                                        {
                                            $and:
                                                [
                                                    { $eq: ["$_id", "$$vendor"] },
                                                ]
                                        }
                                    }
                                },
                                { "$project": { "userLocation": 1, "name": 1, "address": 1 } }
                            ],
                            as: "vendor"
                        }

                    },
                    {
                        $unwind: { path: "$brand" }
                    },
                    {
                        $unwind: { path: "$vendor" }
                    },
                    { "$project": { "seoSettings": 0, "veganType": 0 } }
                ],
                as: "data"
            }
        },
        {
            $unwind: "$data"
        },
        { $project: { data: 1 } },
        {
            $group: {
                _id: "$data._id", userData: { $first: "$data" },

            }
        },
        { $replaceRoot: { newRoot: "$userData" } },
        {
            $set: {
                featured_image: {
                    $cond: [
                        { $or: [{ $eq: [null, "$featured_image"] }, { $eq: ["", "$featured_image"] }] },
                        null,
                        "$featur_img"
                    ]
                }
            }
        },
        { $unset: "featur_img" },

        { $match: obj },
        { $skip: (paged - 1) * pageSize },
        { $limit: parseInt(pageSize) },
        { $sort: { [sortByField]: parseInt(sortOrder) } }
    ],
        callback
    )
}
module.exports.getProductsDriver = (id, callback) => {
    User.findOne({ _id: id }, { "fields": { serviceId: 1 } })
        .populate({ path: "serviceId", populate: 'addons featured_image' })
        .exec(callback);
}

module.exports.getUsersWithFilterForTransaction = function (obj, sortByField, sortOrder, paged, pageSize, callback) {
    return User.aggregate([
        { $match: obj },
        { $lookup: { from: 'files', localField: 'profileImage', foreignField: '_id', as: 'profileImage' } },
        { $sort: { [sortByField]: parseInt(sortOrder) } },
        { $skip: (paged - 1) * pageSize },
        { $limit: parseInt(pageSize) },
        { $unwind: { path: "$profileImage", preserveNullAndEmptyArrays: true } },
        { $project: { name: 1, email: 1, countryCode: 1, mobileNumber: 1, status: 1, profileImage: { link: 1 } } }
    ], callback);
}
module.exports.activateUser = async (_id, callback) => {
    let update = { isActivated: true };
    return User.findOneAndUpdate({ _id }, update, { new: true }, callback);
}
module.exports.getUsersList = function (obj, is_demo, activeStoreType, callback) {
    User.aggregate([
        { $match: obj },
        {
            $addFields: {
                encodemail: { $cond: [is_demo, { $cond: [{ $and: ["$email", { $ne: ["$email", null] }, { $ne: ["$email", ""] }] }, { $substr: ["$email", { $subtract: [{ $strLenCP: "$email" }, 5] }, 5] }, "***"] }, ""] },
                encodphone: { $cond: [is_demo, { $cond: [{ $and: ["$mobileNumber", { $ne: ["$mobileNumber", null] }, { $ne: ["$mobileNumber", ""] }] }, { $substrCP: ["$mobileNumber", { $subtract: [{ $strLenCP: "$mobileNumber" }, 2] }, 2] }, "***"] }, ""] }
            }
        },
        { $lookup: { from: 'roles', localField: 'accessLevel', foreignField: '_id', as: 'accessLevel' } },
        { $lookup: { from: 'storetypes', localField: 'storeType', foreignField: '_id', as: 'storeType' } },
        { $match: activeStoreType },
        { $sort: { _id: -1 } },
        { $unwind: { path: "$accessLevel", preserveNullAndEmptyArrays: true } },
        { $project: { name: 1, email: { $cond: [is_demo, { $concat: ["******", "$encodemail"] }, "$email"] }, countryCode: 1, mobileNumber: { $cond: [is_demo, { $concat: ["******", "$encodphone"] }, "$mobileNumber"] }, status: 1, onlineStatus: 1, bankFields: 1, wallet: 1, role: 1, date_created_utc: 1, accessLevel: { name: 1 } } }
    ], callback);
}
module.exports.updateReferralUserCount = (query, callback) => {
    let update = { $inc: { referralUserCount: 1 } };
    return User.findOneAndUpdate(query, update, { new: true }, callback);
}
module.exports.getVendorInfo = (_id, callback) => {
    let query = { _id, role: "VENDOR", status: "approved" };
    return User.findOne(query, callback)
};
module.exports.addVendorClone = (data, callback) => {
    data.date_created_utc = new Date();
    data.isBankFieldsAdded = false;
    data.orderAutoApproval = false;
    data.status = data.status ? data.status : "created";
    return User.create(data, callback);
}
module.exports.getUsers = (qry, callback) => {
    User.find(qry, callback).populate("profileImage").select('name _id');
}
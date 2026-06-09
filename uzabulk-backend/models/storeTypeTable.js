const mongoose = require('mongoose');
const Config = require('../config/constants.json');

let schema = mongoose.Schema({
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    label: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    geoFence: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Geofence' }],
    storeType: { type: String, enum: Config.SERVICES },
    storeVendorType: { type: String, enum: ["SINGLE", "AGGREAGATOR"], default: "AGGREAGATOR" },
    requestType: { type: String, enum: ["Manual", "Random"] },
    storeTypeImage: { type: mongoose.Schema.Types.ObjectId, ref: 'File', default: null },
    storeTypeIcon: { type: mongoose.Schema.Types.ObjectId, ref: 'File', default: null },
    defaultStoreTypeImage: { type: String },
    storeText: { type: String, default: null },
    deliveryAreaCustomer: { type: Number },
    deliveryAreaDriver: { type: Number },
    poolDriverRadius: { type: Number, default: 5 },
    deliveryAreaVendor: { type: Number },
    deliveryAreaVendorTakeaway: { type: Number },
    noOfDriversPerRequest: { type: Number },
    deliveryType: { type: Array },
    isVeganFilterActive: { type: Boolean },
    hideVendorInfo: { type: Boolean },
    hideStoreType: { type: Boolean, default: false },
    deliveryPlatform: {
        platform: { type: String, enum: ["self", "other"], default: "self" },
        deliveryProviderType: { type: String, enum: ["postmates"], default: "postmates" },
        deliveryProvider: [
            {
                type: { type: String, enum: ["postmates"], default: "postmates" },
                keys: { type: Object }
            }
        ]
    },
    taxSettings: {
        level: { type: String, enum: ["store", "vendor"], default: "vendor" },
        percentage: { type: Number, default: 2 },
    },
    isAdvanceTaxSetting: { type: Boolean, default: false },
    advanceTaxSettings: [{
        name: { type: String },
        percentage: { type: Number },
    }],
    bidSettings: {
        status: { type: Boolean },
        percentage: { type: Number },
        flatAmount: { type: Number },
        requestTimer: { type: Number },
    },
    multiDropsSettings: { type: Boolean },
    vendorWaitTime: { type: Number },
    driverWaitTime: { type: Number },
    deliveryFeeType: { type: String, enum: ["slab", "unit"], default: "unit" },
    freeDeliverySettings: {
        status: { type: Boolean, default: false },
        range: [
            {
                minOrderValue: { type: Number, default: 0 },
                maxOrderValue: { type: Number, default: 50 }
            }
        ]
    },
    deliveryFeeSettings: {
        base_price: { type: Number },
        per_unit_distance: { type: Number },
        per_unit_time: { type: Number }
    }, // delivery boy calculation on base_price and per_unit_distance
    commission:
    {
        per_product: { type: Number },
        vendor: { type: Number },
        deliveryBoy: { type: Number },
    },
    currency: {
        symbol: { type: String, default: "¥" },
        code: { type: String, default: "CNY" },
        rate: { type: Number, default: 1 },
    },
    scheduled: {
        status: { type: Boolean, default: false },
        vendorRequestTime: { type: Number, default: 15 }
    },
    otpSettings: {
        status: { type: Boolean, default: true }
    },
    rideHailingSettings: {
        status: { type: Boolean, default: true }
    },
    cityPricingSettings: {
        status: { type: Boolean, default: false }
    },
    codWalletLimit: { type: Number, default: 0 },
    cancellationPartialRefundAmount: { type: Number }, //this is percentage amount for partial refund
    cancellationPolicy: [{
        status: { type: Boolean, default: false },
        orderStatus: { type: String },
        refundType: { type: String, enum: ["full", "partial", "no"], default: "no" },
        description: { type: String }
    }],
    vehicleType: [{ type: mongoose.Schema.Types.ObjectId, ref: 'VehicleType' }],
    status: { type: String, enum: ["active", "inactive", "archived"], default: "active" },
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
    returnTypeList: [{ type: String }],
    paymentSettings: {
        isPrePayment: { type: Boolean, default: false },
        isPaymentHold: { type: Boolean, default: false }
    },
    isEnableDeliveryTimeSlot: { type: Boolean },
    isManageIndividualPoolTrip: { type: Boolean, default: false },
    date_created: { type: Date },
    date_created_utc: { type: Date },
    date_modified: { type: Date },
    date_modified_utc: { type: Date },
    isEnableCarPool: { type: Boolean },
    hourlyTripSettings: {
        status: { type: Boolean },
        duration: [{
            hours: { type: Number },
            unit: { type: String, enum: ["km", "miles"] },
            distance: { type: Number }
        }]
    },
    multiStopsTripSettings: {
        status: { type: Boolean },
        maxStops: { type: Number },
        waitingTime: { type: Number }
    },
    driverTripFareSettings: { // driver can set their own price.
        status: { type: Boolean },
        field: { type: [String], enum: ["pricePerUnitDistance", "pricePerUnitTimeMinute", "basePrice"] }
    },
    isPriceSetForRequest: {
        type: Boolean,
    },
    meta_data: [
        {
            key: { type: String },
            value: { type: String }
        }
    ],
},
    {
        versionKey: false // You should be aware of the outcome after set to false
    });

schema.statics = {
    taxAmount: async function () {
        const data = await this.findOne(null, "taxSettings.percentage");
        return data?.taxSettings?.percentage || env?.taxSettings?.percentage || 18;
    },
    adminCommission: async function () {
        const data = await this.findOne(null, "commission");
        return data?.commission?.per_product || 0;
    },
    currency: async function () {
        const data = await this.findOne(null, "currency");
        return {
            symbol: data?.currency?.symbol || "¥",
            code: data?.currency?.code || "CNY",
            rate: data?.currency?.rate || 1,
        }
    }
}

const storeTypeTable = module.exports = mongoose.model('StoreType', schema);

module.exports.updateSettings = (data, callback) => {
    let query = { _id: data._id }
    storeTypeTable.findOneAndUpdate(query, data, { "new": true }, callback);
}

module.exports.updateSettingsAsync = (data, callback) => {
    let query = { _id: data._id }
    return storeTypeTable.findOneAndUpdate(query, data, { "new": true }, callback);
}

module.exports.getStoreTypeByStoreId = (storeId, callback) => {
    storeTypeTable.find({ store: storeId, status: "active" })
        .populate({ path: 'storeTypeImage' })
        .populate({ path: 'storeTypeIcon' }).lean()
        .exec(callback);
}

module.exports.getStoreTypeByStoreIdAsync = (storeId, callback) => {
    return storeTypeTable.find({ store: storeId, status: "active" })
        .populate({ path: 'storeTypeImage' })
        .populate({ path: 'storeTypeIcon' }).lean()
        .sort({ orderNumber: 1 })
        .exec(callback);
}

module.exports.getStoreTypeById = (id, callback) => {
    storeTypeTable.findById(id)
        .populate({ path: 'storeTypeImage' })
        .populate({ path: 'storeTypeIcon' })
        .exec(callback);
}

module.exports.getStoreTypeByIdAsync = (id, callback) => {
    return storeTypeTable.findById(id)
        .populate({ path: 'storeTypeImage' })
        .populate({ path: 'storeTypeIcon' })
        .populate({ path: 'store', select: 'tip timezone googleMapKey tipType' })
        .exec(callback);
}

module.exports.getStoreTypeByIdAsyncWithStore = (id, callback) => {
    return storeTypeTable.findById(id)
        .populate({ path: 'storeTypeImage' })
        .populate({ path: 'storeTypeIcon' })
        .populate({ path: 'store', select: 'tip distanceUnit timezone' })
        .exec(callback);
}
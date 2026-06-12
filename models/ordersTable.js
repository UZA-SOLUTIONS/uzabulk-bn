const mongoose = require('mongoose');
const Config = require('../config/constants.json');

let orderSchema = new mongoose.Schema({
    customOrderId: String,
    disputeId: { type: mongoose.Schema.Types.ObjectId, ref: 'dispute' },
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: env.storeId },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addressId: { type: mongoose.Schema.Types.ObjectId, ref: 'Address' },
    deliveryAddress: { type: String },
    billingDetails: { type: Object },
    shippingDetails: { type: Object },
    line_items: { type: Object },
    coupon: { type: String, default: null },
    couponType: { type: String },
    couponBy: { type: String, default: null },
    couponAmount: { type: Number },
    discountTotal: { type: Number, default: 0 },
    couponDiscount: { type: Number },
    deliveryFee: { type: Number },
    taxAmount: { type: Number },
    tax: { type: Number },
    isLoyaltyPointsUsed: { type: Boolean },
    pointsToRedeem: { type: Number },
    redemptionValue: { type: Number },
    subTotal: { type: Number },
    orderTotal: { type: Number },
    duration: { type: Number },
    distance: { type: Number },
    deliveryType: { type: String },
    orderStatus: { type: String, enum: ["pending", "confirmed", "inroute", "completed", "refunded", "rejected", "cancelled", "archived"], default: "pending" },
    paymentMethod: { type: String, enum: Config.PAYMENTGATEWAY, default: "stripe" },
    paymentSourceRef: { type: String },
    transactionId: { type: String },
    transactionDetails: { type: Object },
    refundDetails: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Refund' }],
    paymentStatus: { type: String, enum: ["pending", "process", "success"], default: "pending" },
    commission: { type: Object },
    adminVendorEarning: { type: Number, default: 0 },
    adminDeliveryBoyEarning: { type: Number, default: 0 },
    adminEarning: { type: Number, default: 0 },
    vendorEarning: { type: Number, default: 0 },
    deliveryBoyEarning: { type: Number, default: 0 }, //earning calculation on delivery fee only
    scheduledDate: { type: String },
    scheduledTime: { type: String },
    scheduled_utc: { type: Date },
    date_created: { type: String },
    time_created: { type: String },
    date_created_utc: { type: Date },
    date_user_rejected_utc: { type: Date },
    date_vendor_confirmed_utc: { type: Date },
    date_vendor_rejected_utc: { type: Date },
    date_vendor_cancel_utc: { type: Date },
    date_customer_confirmed_utc: { type: Date },
    date_modified: { type: Date },
    date_modified_utc: { type: Date },
    orderInstructions: { type: String, default: null },
    currency: { type: Object },
    slipUploadStatus: { type: String, enum: ["pending", "uploaded"], default: "pending" },
    slipLink: String,
    orderGroupId: String,
    offerId: { type: String, default: "" },
    alibaba1688: {
        trade_id: { type: String, default: "" },
        primary_order_id: { type: String, default: "" },
        order_ids: { type: [String], default: [] },
        third_order_id: { type: String, default: "" },
        status: { type: String, default: "" },
        payment_url: { type: String, default: "" },
        relayed_at: { type: Date },
        payment_confirmed_at: { type: Date },
        last_synced_at: { type: Date },
        logistics: { type: Array, default: [] },
        buyer_view: { type: Object, default: null },
        raw_create_response: { type: Object, default: null },
        relay_error: { type: String, default: "" },
    },
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


const orderTable = module.exports = mongoose.model('Order', orderSchema);

module.exports.addOrder = (data, callback) => {
    data.isScheduleProcess = false;
    data.isDriverAssign = false;
    data.isDriverArrivedAtPickup = false;
    data.isOrderMarkReady = false;
    data.date_modified_utc = new Date();
    orderTable.create(data, callback);
}

module.exports.updateOrderVendor = function (data, callback) {
    let query = { _id: data._id };
    data.date_modified_utc = new Date();
    orderTable.findOneAndUpdate(query, data, { new: true })
        .populate({ path: 'storeType' })
        .populate({ path: 'store' })
        .populate({ path: 'user', select: 'name fireBaseToken' })
        .exec(callback);
}

module.exports.updateOrderVendorNew = function (data, callback) {
    let query = { _id: data._id };
    data.date_modified_utc = new Date();
    orderTable.findOneAndUpdate(query, data, { new: true })
        .populate({ path: 'user', select: 'name firebaseTokens' })
        .populate({ path: 'vendor', select: 'name firebaseTokens userLocation orderAutoCancel' })
        .populate({ path: 'driver', select: 'name firebaseTokens userLocation' })
        .populate({ path: 'storeType', select: 'storeType driverWaitTime storeType' })
        .populate({ path: 'store', select: 'firebase commissionTransfer orderAutoCancel' })
        .exec(callback);
}

module.exports.updateTripOrder = async function (condition, data) {

    data.date_modified_utc = new Date();
    return await orderTable.updateMany(condition, data, { new: true })

}

module.exports.getOrderById = (id, callback) => {
    orderTable.findById(id)
        .populate(
            {
                path: 'user',
                select: 'name email countryCode mobileNumber',
                populate: {
                    path: 'profileImage'
                }
            }
        )

        .populate(
            {
                path: 'vendor',
                select: 'name email countryCode mobileNumber profileImage address userLocation avgRating',
                populate: {
                    path: 'profileImage'
                }
            }
        )
        .populate({ path: 'driverVehicle' })
        .populate({
            path: 'disputeId',
            populate: {
                path: 'attachment'
            }
        })
        .populate(
            {
                path: 'driver',
                select: 'name email countryCode mobileNumber profileImage userLocation avgRating',
                populate: {
                    path: 'profileImage'
                }
            }
        )
        .populate(
            {
                path: 'storeType',
                select: 'storeType storeVendorType otpSettings bidSettings',
            }
        )
        .populate(
            {
                path: 'refundDetails',
                populate: {
                    path: 'refunded_by',
                    select: 'name'
                }
            }
        )
        .populate(
            {
                path: 'store',
                select: 'hideThings'
            }
        )
        .populate(
            {
                path: 'dropMulti'
            }
        )
        .populate({ path: 'multiStop' })
        .populate(
            {
                path: 'bidDetails',
                match: { status: "pending" },
                populate: [
                    {
                        path: 'driver',
                        select: 'name email profileImage countryCode mobileNumber vehicle userLocation avgRating',
                        populate: [
                            {
                                path: 'profileImage',
                                select: 'link'
                            },

                            {
                                path: "vehicle",
                                populate: {
                                    path: "vehicleType",
                                    select: "image",
                                    populate: {
                                        path: 'image',
                                        select: 'link'
                                    }
                                }
                            }
                        ],

                    }

                ]


            }

        )
        .exec(callback);
}

module.exports.getOrderByIdAsync = (id, callback) => {
    return orderTable.findById(id)
        .populate({ path: 'storeType' })
        .populate({ path: 'store', select: 'storeVersion currency' })
        .populate({ path: 'driverVehicle' })
        .populate(
            {
                path: 'driver',
                select: 'name email countryCode mobileNumber profileImage userLocation',
                populate: {
                    path: 'profileImage'
                }
            }
        )
        .populate({ path: 'user', select: 'wallet' })
        .populate({ path: 'vendor', select: 'userLocation name' })
        .exec(callback);
}
module.exports.getOrderByIdWithtripFare = (id, driver, callback) => {
    let query = {
        _id: id,
        tripFare: { $elemMatch: { driver: driver } },
    }
    let project = {
        "tripFare.$": 1,
    }
    return orderTable.findOne(query, project)
        .exec(callback);
}

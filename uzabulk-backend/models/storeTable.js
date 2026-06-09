const mongoose = require('mongoose');
let slug = require('mongoose-slug-updater');
mongoose.plugin(slug);

let StoreSchema = mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    storeVersion: { type: Number, default: 1 },
    storeName: { type: String, unique: true, trim: true, required: true },
    slug: { type: String, slug: "storeName", unique: true, lowercase: true, slugOn: { findOneAndUpdate: false } },
    email: { type: String },
    mobileNumber: { type: String },
    storeType: [{ type: mongoose.Schema.Types.ObjectId, ref: 'storeType' }],
    address: { type: String },
    otpbypass: { type: Boolean, default: false },
    userLocation: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number] }
    },
    logo: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
    codWalletLimit: { type: Number, default: 0 },
    favIcon: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
    bannerImage: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
    bannerText: { type: String, default: null },
    api_key: { type: String, required: true },
    domain: { type: String },
    country: { type: String },
    countryCode: { type: String },
    language: { type: Object },
    storeLanguage: [{ type: Object }],
    storeCurrency: [{ type: Object }],
    storepaymentMethod: { type: Array, default: [] },
    directPaymentMethod: { type: Array, default: [] },
    currency: { type: Object },
    geofenceType: { type: Object },
    timezone: { type: String },
    plan: {
        productType: { type: String, enum: ["store", "marketplace", "taxi"], default: "store" },
        isTrial: { type: Boolean, default: false },
        chargeType: { type: String },
        isDiscount: { type: Boolean, default: false },
        isAddon: { type: Boolean, default: false },
        billingPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
        planAmount: { type: Number },
        endDate: { type: Date },
        date_grace_period: { type: Date }
    },
    loyaltyPoints: {
        status: { type: Boolean, default: true },
        earningCriteria: {
            points: { type: Number, default: 1 },
            value: { type: Number, default: 5 }
        },
        redemptionCriteria: {
            points: { type: Number, default: 1 },
            value: { type: Number, default: 5 }
        },
        maxRedemptionPercentage: { type: Number, default: 10 },
    },
    cardDetails: { type: mongoose.Schema.Types.ObjectId, ref: 'Card' },
    subscriptionDetails: { type: Object },
    distanceUnit: { type: String, enum: ["km", "miles"], default: "km" },
    googleMapKey: {
        android: { type: String, default: null },
        ios: { type: String, default: null },
        web: { type: String, default: null },
        server: { type: String, default: null }
    },
    tipType: { type: String, enum: ["flat", "percentage"], default: "percentage" },
    tip: { type: Array },
    bankFields: [
        {
            label: { type: String },
            key: { type: String, slug: "label", unique: true, lowercase: true },
            value: { type: String }
        }
    ],
    removeBranding: { type: Boolean, default: false },
    notifications: {
        adminNotification: [
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
        vendorNotification: [
            {
                type: { type: String, enum: ["orderPlaced"], default: "orderPlaced" },
                values: [
                    {
                        key: { type: String, enum: ["notification", "sms", "email"], default: "notification" },
                        value: { type: Boolean, default: false },
                        status: { type: String, enum: ["active", "inactive"], default: "active" }
                    }
                ]
            }
        ]
    },
    notificationSound: { type: String, default: null },
    orderAutoApproval: { type: Boolean, default: false },
    orderAutoCancel: { type: Boolean, default: true },
    vehicle: [{ type: Object }],
    commissionTransfer:
    {
        status: { type: String, enum: ["offline", "online"], default: "offline" },
        payoutSchedule: { type: String, enum: ["realTime", "later"], default: "realTime" },
        scheduleDays: { type: Number, default: 7 }
    },
    paymentMode: { type: String, enum: ["sandbox", "live"], default: "sandbox" },
    paymentSettings: [{ type: Object, default: [] }],
    themeSettings: {
        adminPrimaryBackgroundColor: { type: String },
        adminPrimaryFontColor: { type: String },
        primaryColor: { type: String },
        fontColor: { type: String },
        secondaryColor: { type: String },
        secondaryFontColor: { type: String },
        wrapperBackgroundColor: { type: String },
        wrapperFontColor: { type: String },
        isAppDarkTheme: { type: Boolean, default: false },
        font: { type: String },
        headerStyle: { type: String, enum: ["leftLogo", "centerLogo"], default: "leftLogo" },
        topNavigation: {
            status: { type: Boolean, default: false },
            backgroundColor: { type: String },
            fontColor: { type: String },
            content: { type: String }
        },
        navigation: {
            status: { type: Boolean, default: false },
            backgroundColor: { type: String },
            fontColor: { type: String }
        },
        bodyWrapper: {
            backgroundColor: { type: String },
            fontColor: { type: String }
        },
        button: {
            backgroundColor: { type: String },
            fontColor: { type: String }
        },
        icons: {
            backgroundColor: { type: String },
            fontColor: { type: String }
        },
        hyperlink: {
            fontColor: { type: String }
        },
        sideMenu: {
            backgroundColor: { type: String },
            fontColor: { type: String }
        },
        footer: {
            backgroundColor: { type: String },
            fontColor: { type: String }
        },
        customJs: { type: String },
        customCss: { type: String }
    },
    cookiePolicy: {
        status: { type: String, enum: ["yes", "no"], default: "no" },
        heading: { type: String },
        description: { type: String },
        bodyBackgroundColor: { type: String },
        bodyFontColor: { type: String },
        bodyStyle: { type: String, enum: ["boxStyle", "horizontalBar"], default: "boxStyle" },
        buttonLabel: { type: String },
        buttonBackgroundColor: { type: String },
        buttonFontColor: { type: String },
        linkLabel: { type: String },
        linkUrl: { type: String },
        linkFontColor: { type: String },
        linkTarget: { type: String, enum: ["_blank", "_self"], default: "_self" }
    },
    socialMedia: [
        {
            type: { type: String, enum: ["facebook", "google", "twitter", "instagram", "apple"] },
            link: { type: String }
        }
    ],
    socialMediaLoginSignUp: [{ type: Object, default: [] }],
    appUrl: {
        customer_android_app: { type: String, default: null },
        driver_android_app: { type: String, default: null },
        customer_ios_app: { type: String, default: null },
        driver_ios_app: { type: String, default: null }
    },
    chatCodeScript: { type: String },
    gtmHeadScript: { type: String },
    gtmBodyScript: { type: String },
    dnsId: { type: String },
    twilio: {
        accountSid: { type: String, default: null },
        authToken: { type: String, default: null },
        twilioFrom: { type: String, default: null }

    },
    mailgun: {
        MAILGUN_API_KEY: { type: String, default: null },
        MAILGUN_DOMAIN: { type: String, default: null },
        MAILGUN_FROM: { type: String, default: null }
    },
    firebase: {
        FCM_APIKEY: { type: String, default: null },
        FCM_AUTHDOMAIN: { type: String, default: null },
        FCM_DATABASEURL: { type: String, default: null },
        FCM_PROJECTID: { type: String, default: null },
        FCM_STORAGEBUCKET: { type: String, default: null },
        FCM_MESSAGINGSENDERID: { type: String, default: null },
        FCM_APPID: { type: String, default: null },
        FCM_MEASUREMENTID: { type: String, default: null },
        FCM_CLIENT_EMAIL: { type: String, default: null },
        FCM_PRIVATE_KEY: { type: String, default: null }
    },
    hideThings: { type: Array, default: [] },
    projectstatus: { type: String, enum: ["suspended", "live", "development"], default: "development" },
    status: { type: String, enum: ["active", "inactive", "archived", "suspended", "gracePeriod"], default: "active" },
    deliveryMultiStoretype: { type: Boolean, default: true }, // if true delivery boy able to select multi storetype, otherwise no
    date_created: { type: Date },
    date_created_utc: { type: Date },
    date_modified: { type: Date },
    date_modified_utc: { type: Date },
    tawk_direct_chat_link: { type: String, default: null },
    whatsapp_number: { type: String, default: null },
    referredUserCommission: {
        User: { referredEarningAmount: Number, status: { type: Boolean, default: false } },
        Driver: { referredEarningAmount: Number, status: { type: Boolean, default: false } },
        refereeAccountDeleteDays: Number, // Number of days within which the account must be deleted for refund referral amount

    },
    isEnabledWalletToWallet: { type: Boolean, default: false },
    activePaymentMethodForAddCard: { type: String },
    tokenExpiresIn: { type: String },
    userRefereeSetting: { status: { type: Boolean, default: false }, addAmountToWallet: Number },
    avoidFraudSetting: { status: Boolean, numOfOrderCancel: Number, driverBlockTime: Number },
    is_web_allow: { type: Boolean, default: false },
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

const StoreTable = module.exports = mongoose.model('Store', StoreSchema);

module.exports.addStore = (data, callback) => {
    data.date_created_utc = new Date();
    StoreTable.create(data, callback);
}

//get all users
module.exports.getStores = (callback) => {
    StoreTable.find().populate('plan.billingPlan').exec(callback);
}

module.exports.getStorePaymentSettingAsync = (id, callback) => {
    return StoreTable.findById(id, 'paymentSettings paymentMode timezone googleMapKey tip currency', callback);
}

module.exports.getStoreSettingAsync = (id, callback) => {
    return StoreTable.findById(id, 'storeName notifications orderAutoCancel owner logo paymentSettings language themeSettings mailgun domain paymentMode googleMapKey tip timezone currency distanceUnit loyaltyPoints orderAutoApproval twilio firebase')
        .populate({ path: 'logo' })
        .populate({ path: 'owner', select: "email" })
        .exec(callback);;
}

module.exports.getStoreSettingById = (id, callback) => {
    StoreTable.findById(id, 'avoidFraudSetting activePaymentMethodForAddCard storeName storeLanguage userLocation orderAutoCancel gtmHeadScript gtmBodyScript address storeVersion slug email removeBranding codWalletLimit orderAutoApproval mobileNumber favIcon logo bannerImage bannerText domain country language currency countryCode timezone distanceUnit googleMapKey tipType tip paymentMode paymentSettings themeSettings socialMedia appUrl deliveryMultiStoretype bankFields chatCodeScript notifications notificationSound loyaltyPoints twilio mailgun firebase status commissionTransfer socialMediaLoginSignUp cookiePolicy vehicle storeCurrency storepaymentMethod geofenceType hideThings whatsapp_number tawk_direct_chat_link referredUserCommission isEnabledWalletToWallet directPaymentMethod')
        .populate({ path: 'storeType', select: 'storeType label storeVendorType status hideStoreType isEnableCarPool' })
        .populate({ path: 'logo' })
        .populate({ path: 'bannerImage' })
        .populate({ path: 'favIcon' })
        .populate({ path: 'owner', select: 'storeType' })
        .exec(callback);
}

module.exports.getStoreDataByIdForSettingScript = (id, callback) => {
    StoreTable.findById(id)
        .populate({ path: 'storeType', select: 'storeType label storeVendorType status' })
        .populate({ path: 'logo' })
        .populate({ path: 'bannerImage' })
        .populate({ path: 'favIcon' })
        .populate({ path: 'plan.billingPlan', select: 'name type' })
        .exec(callback);
}

module.exports.getStoreSettingByIdForApps = (id, callback) => {
    StoreTable.findById(id, 'storeName domain slug email mobileNumber logo language country countryCode currency timezone distanceUnit googleMapKey paymentMode paymentSettings themeSettings socialMedia appUrl deliveryMultiStoretype bankFields chatCodeScript loyaltyPoints socialMediaLoginSignUp tipType tip referredUserCommission isEnabledWalletToWallet storeLanguage userRefereeSetting')
        .populate({ path: 'storeType', match: { status: 'active' }, select: 'storeType multiDropsSettings returnTypeList bidSettings storeVendorType status deliveryType rideHailingSettings requestType isManageIndividualPoolTrip isEnableCarPool hourlyTripSettings multiStopsTripSettings driverTripFareSettings' })
        .populate({ path: 'logo' })
        .populate({ path: 'bannerImage' })
        .populate({ path: 'plan.billingPlan', select: 'name type' })
        .exec(callback);
}

module.exports.updateSettings = (data, callback) => {
    let query = { _id: data._id }
    data.date_modified_utc = new Date();
    StoreTable.findOneAndUpdate(query, data, { fields: { cardDetails: 0, subscriptionDetails: 0 }, "new": true })
        .populate({ path: 'storeType', select: 'storeType label storeVendorType status deliveryType requestType hourlyTripSettings multiStopsTripSettings' })
        .populate({ path: 'logo' })
        .populate({ path: 'bannerImage' })
        .populate({ path: 'favIcon' })
        .populate({ path: 'plan.billingPlan' })
        .exec(callback);
}

module.exports.updateSettingsAsync = (data, callback) => {
    let query = { _id: data._id }
    data.date_modified_utc = new Date();
    return StoreTable.findOneAndUpdate(query, data, { fields: { cardDetails: 0, subscriptionDetails: 0 }, "new": true })
        .populate({ path: 'storeType', select: 'storeType storeVendorType status' })
        .populate({ path: 'logo' })
        .populate({ path: 'bannerImage' })
        .populate({ path: 'favIcon' })
        .exec(callback);
}

module.exports.getAccountSetup = (id, callback) => {
    return StoreTable.findOne({
        _id: id,
        $or: [
            { "googleMapKey.android": { $exists: true, $ne: "" } },
            { "googleMapKey.ios": { $exists: true, $ne: "" } },
            { "googleMapKey.web": { $exists: true, $ne: "" } },
            { "googleMapKey.server": { $exists: true, $ne: "" } },
            /* { "appUrl.customer_android_app": { $exists: true, $eq: "" } },
            { "appUrl.driver_android_app": { $exists: true, $eq: "" } },
            { "appUrl.customer_ios_app": { $exists: true, $eq: "" } },
            { "appUrl.driver_ios_app": { $exists: true, $eq: "" } } */
        ]
    }, callback)
}
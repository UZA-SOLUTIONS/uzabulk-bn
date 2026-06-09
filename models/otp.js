const mongoose = require("mongoose");
// const Schema = mongoose.Schema;
let OtpSchema = mongoose.Schema({
    store: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null },
    otp: {
        type: String
    },
    mobileNumber: {
        type: String
    },
    countryCode: {
        type: String
    },
    email: {
        type: String
    },
    otpExpires: { type: Date, required: true },
}, {
    timestamps: true
});
let Otp = mongoose.model('OtpTracker', OtpSchema);

module.exports = Otp;
const mongoose = require("mongoose");

let schema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    token: { type: String },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
let UserSession = mongoose.model('UserSession', schema);

module.exports = UserSession;
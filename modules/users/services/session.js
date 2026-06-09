const mongoose = require("mongoose");
const UserSession = require("../../../models/userSessionTable");

const toUserObjectId = (userId) => {
    if (userId == null) return userId;
    if (userId instanceof mongoose.Types.ObjectId) return userId;
    const s = String(userId).trim();
    if (mongoose.isValidObjectId(s)) return new mongoose.Types.ObjectId(s);
    return userId;
};

exports.saveToken = async (userId, token) => {
    return await UserSession.create({ userId: toUserObjectId(userId), token });
};

exports.hasToken = async function (userId, token) {
    return UserSession.findOne({ userId: toUserObjectId(userId), token }).lean();
};

exports.logout = async function (userId, token) {
    await UserSession.deleteOne({ userId: toUserObjectId(userId), token }).exec();
};

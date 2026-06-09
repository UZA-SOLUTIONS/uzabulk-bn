const UserSession = require('../../../models/userSessionTable');

exports.saveToken = async (userId, token) => {
    return await UserSession.create({ userId, token });
}

exports.hasToken = async function (userId, token) {
    return UserSession.findOne({ userId, token }).lean();
}


exports.logout = async function (userId, token) {
    await UserSession.deleteOne({ userId, token }).exec();
}
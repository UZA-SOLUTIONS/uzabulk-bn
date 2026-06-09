const { verifyToken } = require("../utils");
const UserServices = require('../modules/users/services');
const SessionServices = require('../modules/users/services/session');
const { getBearerToken } = require("./bearerToken");

const authenticate = async (req, res, next) => {
    try {

        const token = getBearerToken(req);

        if (!token) {
            return res.error({
                message: "AUTHORIZATION_TOKEN_IS_REQUIRED",
                code: 401

            });
        }

        const decodedToken = verifyToken(token);

        const sessionUserId = decodedToken.id || decodedToken._id;
        const hasToken = await SessionServices.hasToken(sessionUserId, token);
        if (!hasToken)
            return res.error({
                message: 'NOT_AUTHORIZED',
                code: 401
            });

        const user = await UserServices.findOne({
            _id: decodedToken.id || decodedToken._id,
            status: { $nin: ["temp", "archived"] },
        });

        if (!user)
            return res.error({
                message: 'NOT_AUTHORIZED',
                code: 401
            });

        if (user.status === "inactive")
            return res.error({
                message: "ACCOUNT_INACTIVE",
                code: 401
            });

        if (user.status === "blocked")
            return res.error({
                message: "ACCOUNT_BLOCKED",
                code: 401
            });


        req.user = user;
        req.token = token;

        next();

    } catch (error) {
        return res.error({
            message: "INVALID_TOKEN",
            code: 401

        });
    }
};


module.exports = authenticate;
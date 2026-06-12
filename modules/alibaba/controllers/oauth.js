const {
    getAuthorizeUrl,
    exchangeCodeForToken,
    isOAuthEnabled,
} = require("../services/oauthService");

module.exports = {
    authorizeUrl: async (req, res) => {
        try {
            if (!isOAuthEnabled()) {
                return res.error("ALIBABA_OAUTH_DISABLED");
            }
            const state = req.query.state || `uza_${Date.now()}`;
            return res.success("AUTHORIZE_URL", { url: getAuthorizeUrl(state), state });
        } catch (error) {
            console.error(error);
            return res.error(error);
        }
    },

    callback: async (req, res) => {
        try {
            const code = req.query.code;
            if (!code) {
                return res.error("OAUTH_CODE_MISSING");
            }

            const token = await exchangeCodeForToken(code);
            return res.success("OAUTH_TOKEN_STORED", {
                member_id: token.member_id || token.memberId,
                expires_in: token.expires_in,
            });
        } catch (error) {
            console.error(error);
            return res.error(error.message || error);
        }
    },
};

/**
 * Runtime status of 1688 + DashScope integrations for config/health endpoints.
 */
const client = require("../../../lib/alibaba1688Client");
const { isOAuthEnabled } = require("./oauthService");
const { TRADE_ENABLED } = require("../../orders/services/alibabaTrade");

const getIntegrationStatus = async () => {
    const alibabaConfigured = client.isConfigured();
    const dashscopeConfigured = Boolean(env?.dashscope?.API_KEY);

    return {
        alibaba1688: {
            configured: alibabaConfigured,
            trade_enabled: TRADE_ENABLED(),
            oauth_enabled: isOAuthEnabled(),
            product_apis: alibabaConfigured,
            trade_apis: alibabaConfigured && TRADE_ENABLED(),
            logistics_apis: alibabaConfigured && TRADE_ENABLED(),
            supplier_apis: alibabaConfigured,
            jobs: {
                supplier_verification: process.env.SUPPLIER_VERIFICATION_JOB_ENABLED !== "false",
                catalog_sync: process.env.ALIBABA_CATALOG_SYNC_JOB_ENABLED !== "false",
                logistics_poll: process.env.ALIBABA_LOGISTICS_JOB_ENABLED !== "false",
                oauth_refresh: isOAuthEnabled() && process.env.ALIBABA_OAUTH_REFRESH_JOB_ENABLED !== "false",
            },
        },
        dashscope: {
            configured: dashscopeConfigured,
            smart_listing: dashscopeConfigured && env.dashscope.AUTO_SMART_LISTING !== "false",
            ai_search: dashscopeConfigured && env.dashscope.AI_SEARCH !== "false",
            recommendations: dashscopeConfigured && env.dashscope.AUTO_RECOMMENDATIONS !== "false",
            model: env.dashscope.MODEL,
            embedding_model: env.dashscope.EMBEDDING_MODEL,
        },
    };
};

module.exports = { getIntegrationStatus };

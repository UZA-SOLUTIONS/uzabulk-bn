const {
    isOAuthEnabled,
    refreshAccessToken,
    ensureFreshToken,
} = require("../modules/alibaba/services/oauthService");

const HOUR_MS = 60 * 60 * 1000;
const ENABLED = String(process.env.ALIBABA_OAUTH_REFRESH_JOB_ENABLED || "true").toLowerCase() !== "false";
const INTERVAL_HOURS = Number(process.env.ALIBABA_OAUTH_REFRESH_INTERVAL_HOURS || 12);

let intervalHandle = null;

const runOAuthRefreshJob = async () => {
    if (!isOAuthEnabled()) return;

    try {
        const token = await ensureFreshToken();
        if (token) {
            console.log("[1688-oauth-job] Access token verified/refreshed");
            return;
        }
        const refreshed = await refreshAccessToken();
        if (refreshed?.access_token) {
            console.log("[1688-oauth-job] Token refreshed via refresh_token");
        }
    } catch (error) {
        console.warn("[1688-oauth-job] Failed:", error.message);
    }
};

const startOAuthRefreshJob = () => {
    if (!ENABLED || !isOAuthEnabled()) {
        return;
    }

    const intervalMs = Math.max(1, INTERVAL_HOURS) * HOUR_MS;

    setTimeout(() => {
        runOAuthRefreshJob().catch((e) => console.warn("[1688-oauth-job] Initial:", e.message));
    }, 30_000);

    intervalHandle = setInterval(() => {
        runOAuthRefreshJob().catch((e) => console.warn("[1688-oauth-job] Scheduled:", e.message));
    }, intervalMs);

    console.log(`[1688-oauth-job] Scheduled every ${INTERVAL_HOURS}h`);
};

const stopOAuthRefreshJob = () => {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
};

module.exports = {
    startOAuthRefreshJob,
    stopOAuthRefreshJob,
    runOAuthRefreshJob,
};

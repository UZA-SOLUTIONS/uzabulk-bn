/**
 * 1688 OAuth 2.0 — authorize URL, code exchange, refresh token.
 * @see https://open.1688.com
 */
const axios = require("axios");
const {
    buildSignedUrl,
    getConfig,
    setTokenResolver,
} = require("../../../lib/alibaba1688Client");
const AlibabaToken = require("../../../models/alibabaTokenTable");

const OAUTH_AUTHORIZE_URL = "https://auth.1688.com/oauth/authorize";
const TOKEN_PATH = (appKey) => `http/1/system.oauth2/getToken/${appKey}`;
const REFRESH_PATH = (appKey) => `http/1/system.oauth2/refreshToken/${appKey}`;

const getRedirectUri = () =>
    process.env.ALIBABA_OAUTH_REDIRECT_URI
    || `${env.BASE_URL || ""}/api/v1/alibaba/oauth/callback`;

const isOAuthEnabled = () =>
    String(process.env.ALIBABA_OAUTH_ENABLED || "").toLowerCase() === "true";

const getAuthorizeUrl = (state = "") => {
    const { appKey } = getConfig();
    const params = new URLSearchParams({
        client_id: appKey,
        site: "1688",
        redirect_uri: getRedirectUri(),
        state: state || `uza_${Date.now()}`,
    });
    return `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
};

const exchangeCodeForToken = async (code) => {
    const { appKey, appSecret, baseUrl } = getConfig();
    const urlPath = TOKEN_PATH(appKey);
    const params = {
        grant_type: "authorization_code",
        need_refresh_token: "true",
        client_id: appKey,
        client_secret: appSecret,
        redirect_uri: getRedirectUri(),
        code: String(code),
    };

    const url = buildSignedUrl(urlPath, params, appSecret, baseUrl);
    const response = await axios.post(url, null, {
        timeout: 30000,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const body = response?.data;
    if (!body?.access_token) {
        throw new Error(body?.error_description || body?.error_message || "OAUTH_TOKEN_EXCHANGE_FAILED");
    }

    await AlibabaToken.upsertToken(appKey, body);
    return body;
};

const refreshAccessToken = async () => {
    const { appKey, appSecret, baseUrl } = getConfig();
    const stored = await AlibabaToken.getByAppKey(appKey);
    if (!stored?.refresh_token) {
        return null;
    }

    const urlPath = REFRESH_PATH(appKey);
    const params = {
        grant_type: "refresh_token",
        client_id: appKey,
        client_secret: appSecret,
        refresh_token: stored.refresh_token,
    };

    const url = buildSignedUrl(urlPath, params, appSecret, baseUrl);
    const response = await axios.post(url, null, {
        timeout: 30000,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const body = response?.data;
    if (!body?.access_token) {
        console.warn("[1688-oauth] Refresh failed:", body?.error_description || body?.error_message);
        return null;
    }

    await AlibabaToken.upsertToken(appKey, {
        ...body,
        refresh_token: body.refresh_token || stored.refresh_token,
    });
    return body;
};

const resolveStoredAccessToken = async () => {
    const { appKey, authToken } = getConfig();

    if (!isOAuthEnabled()) {
        return authToken || null;
    }

    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 1) {
        return authToken || null;
    }

    try {
        const stored = await AlibabaToken.getByAppKey(appKey);

        if (!stored?.access_token) {
            return authToken || null;
        }

        const expiresAt = stored.expires_at ? new Date(stored.expires_at).getTime() : 0;
        const bufferMs = Number(process.env.ALIBABA_TOKEN_REFRESH_BUFFER_MS || 300000);

        if (expiresAt > 0 && expiresAt - Date.now() < bufferMs) {
            const refreshed = await refreshAccessToken();
            if (refreshed?.access_token) {
                return refreshed.access_token;
            }
        }

        return stored.access_token;
    } catch (error) {
        console.warn("[1688-oauth] Token lookup failed, using env token:", error.message);
        return authToken || null;
    }
};

const initTokenResolver = () => {
    if (!isOAuthEnabled()) {
        setTokenResolver(async () => getConfig().authToken || null);
        return;
    }
    setTokenResolver(resolveStoredAccessToken);
};

const ensureFreshToken = async () => {
    if (!isOAuthEnabled()) {
        return getConfig().authToken || null;
    }
    return resolveStoredAccessToken();
};

module.exports = {
    getAuthorizeUrl,
    exchangeCodeForToken,
    refreshAccessToken,
    resolveStoredAccessToken,
    initTokenResolver,
    ensureFreshToken,
    isOAuthEnabled,
    getRedirectUri,
};

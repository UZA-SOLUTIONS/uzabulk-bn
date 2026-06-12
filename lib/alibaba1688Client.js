/**
 * Centralized 1688 Open Platform client (param2 + http OAuth namespaces).
 * HMAC-SHA1 signing per gw.open.1688.com spec.
 */
const axios = require("axios");
const crypto = require("crypto");

const DEFAULT_TIMEOUT_MS = Number(process.env.ALIBABA_API_TIMEOUT_MS || 60000);
const MAX_RETRIES = Number(process.env.ALIBABA_API_MAX_RETRIES || 2);

const getConfig = () => ({
    baseUrl: env?.alibaba?.BASE_APP_URL || "http://gw.open.1688.com/openapi/",
    appKey: env?.alibaba?.APP_KEY || "",
    appSecret: env?.alibaba?.APP_SECRET || "",
    authToken: env?.alibaba?.AUTH_TOKEN || "",
});

const is1688Success = (result) =>
    result?.success === true || result?.success === "true" || result?.success === 1;

const isGatewayAclDecline = (body) => {
    if (!body || typeof body !== "object") return false;
    const code = String(body?.error_code || body?.code || body?.result?.code || "");
    const msg = String(body?.error_message || body?.message || body?.result?.message || "");
    return code.includes("APIACL") || /AppKey is not allowed/i.test(msg);
};

const generateHmacSha1Signature = (data, secretKey) =>
    crypto.createHmac("sha1", secretKey).update(data).digest("hex").toUpperCase();

const generateApiSignature = (urlPath, params, secretKey) => {
    const paramString = Object.entries(params)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([key, value]) => `${key}${value}`)
        .join("");
    const signature = generateHmacSha1Signature(`${urlPath}${paramString}`, secretKey);
    const urlParams = new URLSearchParams(params);
    urlParams.append("_aop_signature", signature);
    return `${urlPath}?${urlParams.toString()}`;
};

const buildSignedUrl = (urlPath, params, secretKey, baseUrl) => {
    const signedPathAndQuery = generateApiSignature(urlPath, params, secretKey);
    return new URL(signedPathAndQuery, baseUrl).toString();
};

const unwrap1688Body = (response) => {
    const body = response?.data;
    if (!body || isGatewayAclDecline(body)) {
        return { ok: false, data: null, error: body?.error_message || body?.message || "ACL_DECLINED", raw: body };
    }

    if (body.result != null) {
        const top = body.result;
        if (is1688Success(top)) {
            return { ok: true, data: top.result !== undefined ? top.result : top, raw: body };
        }
        if (typeof top === "object") {
            const errMsg = top.message || top.errMsg || top.errorMessage || "1688_API_FAILED";
            return { ok: false, data: top, error: errMsg, raw: body };
        }
    }

    return { ok: true, data: body, raw: body };
};

let tokenResolver = null;

const setTokenResolver = (fn) => {
    tokenResolver = typeof fn === "function" ? fn : null;
};

const resolveAccessToken = async () => {
    if (tokenResolver) {
        const resolved = await tokenResolver();
        if (resolved) return resolved;
    }
    return getConfig().authToken || "";
};

const isConfigured = () => {
    const { appKey, appSecret, authToken } = getConfig();
    return Boolean(appKey && appSecret && (authToken || tokenResolver));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const request = async (method, urlPath, params = {}, options = {}) => {
    const { appKey, appSecret, baseUrl } = getConfig();
    if (!appKey || !appSecret) {
        return { ok: false, data: null, error: "ALIBABA_CREDENTIALS_MISSING", raw: null };
    }

    const accessToken = await resolveAccessToken();
    if (!accessToken) {
        return { ok: false, data: null, error: "ALIBABA_ACCESS_TOKEN_MISSING", raw: null };
    }

    const signedParams = {
        ...params,
        access_token: accessToken,
        _aop_timestamp: params._aop_timestamp || Date.now().toString(),
    };

    const retries = options.retries ?? MAX_RETRIES;
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            const url = buildSignedUrl(urlPath, signedParams, appSecret, baseUrl);
            const axiosConfig = {
                timeout: options.timeoutMs || DEFAULT_TIMEOUT_MS,
                headers: method === "POST"
                    ? { "Content-Type": "application/x-www-form-urlencoded" }
                    : { "Content-Type": "application/json" },
            };

            const response = method === "POST"
                ? await axios.post(url, null, axiosConfig)
                : await axios.get(url, axiosConfig);

            const result = unwrap1688Body(response);
            if (result.ok || isGatewayAclDecline(result.raw)) {
                return result;
            }

            lastError = result.error;
            if (attempt < retries) {
                await sleep(300 * (attempt + 1));
            }
        } catch (error) {
            if (isGatewayAclDecline(error?.response?.data)) {
                return { ok: false, data: null, error: "API_ACL_DECLINED", raw: error.response?.data };
            }
            lastError = error?.response?.data?.message || error.message;
            if (attempt < retries) {
                await sleep(300 * (attempt + 1));
            }
        }
    }

    return { ok: false, data: null, error: lastError || "1688_REQUEST_FAILED", raw: null };
};

const get = (urlPath, params, options) => request("GET", urlPath, params, options);
const post = (urlPath, params, options) => request("POST", urlPath, params, options);

const urlPath = (namespace, apiName) =>
    `param2/1/${namespace}/${apiName}/${getConfig().appKey}`;

module.exports = {
    get,
    post,
    urlPath,
    isConfigured,
    isGatewayAclDecline,
    is1688Success,
    unwrap1688Body,
    generateApiSignature,
    buildSignedUrl,
    setTokenResolver,
    resolveAccessToken,
    getConfig,
};

/**
 * 1688 supplier APIs: alibaba.member.get + alibaba.company.get
 * Uses the same signed param2 gateway as product APIs.
 */
const axios = require("axios");
const crypto = require("crypto");

const ALIBABA_BASE_APP_URL = env?.alibaba?.BASE_APP_URL || "http://gw.open.1688.com/openapi/";
const ALIBABA_APP_KEY = env?.alibaba?.APP_KEY || "";
const ALIBABA_APP_SECRET = env?.alibaba?.APP_SECRET || "";
const ALIBABA_AUTH_TOKEN = env?.alibaba?.AUTH_TOKEN || "";

const generateHmacSha1Signature = (data, secretKey) => {
    const hmac = crypto.createHmac("sha1", secretKey);
    hmac.update(data);
    return hmac.digest("hex").toUpperCase();
};

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

const is1688Success = (result) =>
    result?.success === true || result?.success === "true" || result?.success === 1;

const isGatewayAclDecline = (body) => {
    const code = String(body?.error_code || body?.code || body?.result?.code || "");
    const msg = String(body?.error_message || body?.message || body?.result?.message || "");
    return code.includes("APIACL") || /AppKey is not allowed/i.test(msg);
};

const unwrap1688Body = (response) => {
    const body = response?.data;
    if (!body || isGatewayAclDecline(body)) return null;

    if (body.result != null) {
        const top = body.result;
        if (is1688Success(top)) {
            return top.result !== undefined ? top.result : top;
        }
        if (typeof top === "object" && !top.success) {
            return top;
        }
    }

    return body;
};

const signedPost = async (urlPath, params) => {
    if (!ALIBABA_APP_KEY || !ALIBABA_APP_SECRET || !ALIBABA_AUTH_TOKEN) {
        return null;
    }

    try {
        const signedPathAndQuery = generateApiSignature(urlPath, params, ALIBABA_APP_SECRET);
        const url = new URL(signedPathAndQuery, ALIBABA_BASE_APP_URL).toString();
        const response = await axios.post(url, null, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: 60000,
        });
        return unwrap1688Body(response);
    } catch (error) {
        if (isGatewayAclDecline(error?.response?.data)) return null;
        console.warn(
            "1688 supplier API error:",
            urlPath.split("/").slice(-2).join("/"),
            error?.response?.data?.message || error.message
        );
        return null;
    }
};

const buildMemberParams = (memberId) => ({
    access_token: ALIBABA_AUTH_TOKEN,
    _aop_timestamp: Date.now().toString(),
    memberId: String(memberId),
});

/**
 * alibaba.member.get — seller / member profile.
 * @param {string} memberId — 1688 member id (e.g. b2b-2208836638143)
 */
const getAlibabaMember = async (memberId) => {
    const id = String(memberId || "").trim();
    if (!id) return null;

    const urlPath = `param2/1/com.alibaba.member/alibaba.member.get/${ALIBABA_APP_KEY}`;
    let payload = await signedPost(urlPath, buildMemberParams(id));

    if (!payload) {
        payload = await signedPost(urlPath, {
            ...buildMemberParams(id),
            loginId: id,
        });
    }

    return payload;
};

/**
 * alibaba.company.get — registered company档案 for a member.
 * @param {string} memberId
 */
const getAlibabaCompany = async (memberId) => {
    const id = String(memberId || "").trim();
    if (!id) return null;

    const urlPath = `param2/1/com.alibaba.company/alibaba.company.get/${ALIBABA_APP_KEY}`;
    let payload = await signedPost(urlPath, buildMemberParams(id));

    if (!payload) {
        payload = await signedPost(urlPath, {
            access_token: ALIBABA_AUTH_TOKEN,
            _aop_timestamp: Date.now().toString(),
            companyParam: JSON.stringify({ memberId: id }),
        });
    }

    return payload;
};

const fetchSupplierProfileFrom1688 = async (memberId) => {
    const [member, company] = await Promise.all([
        getAlibabaMember(memberId),
        getAlibabaCompany(memberId),
    ]);
    return { member, company };
};

module.exports = {
    getAlibabaMember,
    getAlibabaCompany,
    fetchSupplierProfileFrom1688,
};

const axios = require("axios");
const jwt = require("jsonwebtoken");

const GOOGLE_VISION_API_KEY =
    env?.google?.VISION_API_KEY ||
    env?.GOOGLE?.VISION_API_KEY ||
    env?.GOOGLE_VISION_API_KEY ||
    "";
const GOOGLE_CLIENT_EMAIL =
    env?.google?.CLIENT_EMAIL ||
    process.env.GOOGLE_CLIENT_EMAIL ||
    "";
const GOOGLE_PRIVATE_KEY_RAW =
    env?.google?.PRIVATE_KEY ||
    process.env.GOOGLE_PRIVATE_KEY ||
    "";
const GOOGLE_TOKEN_URI =
    env?.google?.TOKEN_URI ||
    process.env.GOOGLE_TOKEN_URI ||
    "https://oauth2.googleapis.com/token";

const GOOGLE_VISION_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";
const GOOGLE_VISION_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

let tokenCache = {
    accessToken: "",
    expiresAtMs: 0,
};

const normalizeKeyword = (value = "") =>
    String(value || "")
        .toLowerCase()
        .replace(/[^\w\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const appendKeyword = (output, seen, keyword) => {
    const normalized = normalizeKeyword(keyword);
    if (!normalized || normalized.length < 3 || seen.has(normalized)) return;
    seen.add(normalized);
    output.push(normalized);
};

const extractKeywords = (annotate = {}, maxKeywords = 8) => {
    const keywords = [];
    const seen = new Set();

    const bestGuess = Array.isArray(annotate?.webDetection?.bestGuessLabels)
        ? annotate.webDetection.bestGuessLabels
        : [];
    bestGuess.forEach((entry) => appendKeyword(keywords, seen, entry?.label));

    const entities = Array.isArray(annotate?.webDetection?.webEntities)
        ? [...annotate.webDetection.webEntities]
        : [];
    entities
        .sort((a, b) => Number(b?.score || 0) - Number(a?.score || 0))
        .forEach((entry) => appendKeyword(keywords, seen, entry?.description));

    const labels = Array.isArray(annotate?.labelAnnotations)
        ? [...annotate.labelAnnotations]
        : [];
    labels
        .sort((a, b) => Number(b?.score || 0) - Number(a?.score || 0))
        .forEach((entry) => appendKeyword(keywords, seen, entry?.description));

    return keywords.slice(0, maxKeywords);
};

const getNormalizedPrivateKey = () => {
    const source = String(GOOGLE_PRIVATE_KEY_RAW || "").trim();
    if (!source) return "";
    return source.replace(/\\n/g, "\n");
};

const getServiceAccountAccessToken = async () => {
    const privateKey = getNormalizedPrivateKey();
    if (!GOOGLE_CLIENT_EMAIL || !privateKey) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (tokenCache.accessToken && tokenCache.expiresAtMs > Date.now() + 60 * 1000) {
        return tokenCache.accessToken;
    }

    const assertion = jwt.sign(
        {
            iss: GOOGLE_CLIENT_EMAIL,
            scope: GOOGLE_VISION_SCOPE,
            aud: GOOGLE_TOKEN_URI,
            iat: nowSec,
            exp: nowSec + 3600,
        },
        privateKey,
        { algorithm: "RS256" }
    );

    const body = new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
    }).toString();

    const response = await axios.post(GOOGLE_TOKEN_URI, body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 30000,
    });

    const accessToken = String(response?.data?.access_token || "");
    const expiresInSec = Number(response?.data?.expires_in || 3600);
    if (!accessToken) return null;

    tokenCache = {
        accessToken,
        expiresAtMs: Date.now() + Math.max(300, expiresInSec) * 1000,
    };
    return accessToken;
};

const searchGoogleImageKeywords = async ({ imageAddress, maxKeywords = 8 }) => {
    if (!imageAddress || typeof imageAddress !== "string") {
        return null;
    }

    try {
        let endpoint = GOOGLE_VISION_ENDPOINT;
        const requestConfig = { timeout: 30000 };

        const accessToken = await getServiceAccountAccessToken();
        if (accessToken) {
            requestConfig.headers = {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            };
        } else if (GOOGLE_VISION_API_KEY) {
            endpoint = `${GOOGLE_VISION_ENDPOINT}?key=${encodeURIComponent(GOOGLE_VISION_API_KEY)}`;
        } else {
            console.warn("Google Vision credentials are missing for image search.");
            return null;
        }

        const response = await axios.post(
            endpoint,
            {
                requests: [
                    {
                        image: {
                            source: {
                                imageUri: imageAddress.trim(),
                            },
                        },
                        features: [
                            { type: "WEB_DETECTION", maxResults: 10 },
                            { type: "LABEL_DETECTION", maxResults: 10 },
                        ],
                    },
                ],
            },
            requestConfig
        );

        const annotate = response?.data?.responses?.[0];
        if (!annotate || annotate?.error) {
            console.warn("Google Vision annotate response contains errors.", annotate?.error);
            return null;
        }

        const keywords = extractKeywords(annotate, maxKeywords);
        if (!keywords.length) return null;

        return {
            keywords,
            primaryKeyword: keywords[0],
        };
    } catch (error) {
        console.error("Google Vision image search failed:", error?.response?.data || error?.message || error);
        return null;
    }
};

module.exports = { searchGoogleImageKeywords };

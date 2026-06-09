/**
 * Reads Authorization header case-insensitively and extracts the JWT/credential part.
 */
const getBearerToken = (req) => {
    const raw = req.get("Authorization") || req.get("authorization");
    if (!raw || typeof raw !== "string") return "";
    const trimmed = raw.trim();
    const m = trimmed.match(/^Bearer\s+(.+)$/i);
    const token = (m ? m[1] : trimmed).trim();
    return token;
};

module.exports = { getBearerToken };

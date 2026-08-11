/**
 * Detect 1688-style numeric offer IDs used in search and product lookup.
 */
const looksLikeOfferId = (value = "") => {
    const s = String(value || "").trim();
    if (!/^\d+$/.test(s) || s.length < 4 || s.length > 30) return false;
    // Avoid treating 24-char hex Mongo ObjectIds as offer IDs.
    if (s.length === 24 && /^[a-fA-F0-9]{24}$/.test(s)) return false;
    return true;
};

const normalizeOfferIdCandidates = (value = "") => {
    const raw = String(value || "").trim();
    if (!looksLikeOfferId(raw)) return [];
    const candidates = [raw];
    const noLeadingZeros = raw.replace(/^0+(?=\d)/, "");
    if (noLeadingZeros && noLeadingZeros !== raw && looksLikeOfferId(noLeadingZeros)) {
        candidates.push(noLeadingZeros);
    }
    return [...new Set(candidates)];
};

module.exports = {
    looksLikeOfferId,
    normalizeOfferIdCandidates,
};

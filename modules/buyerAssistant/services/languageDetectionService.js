const RW_MARKERS = [
    "muraho", "mwiriwe", "amakuru", "urakoze", "murakoze", "yego", "oya", "ndashaka",
    "bite", "mwaramutse", "amahoro", "ubumwe", "icyo", "iki", "none", "nyuma",
];
const FR_MARKERS = [
    "bonjour", "merci", "salut", "comment", "livraison", "commande", "prix",
    "produit", "où", "quand", "je voudrais", "s'il vous plaît", "svp",
];

const scoreMarkers = (text, markers) => {
    const lower = String(text || "").toLowerCase();
    return markers.reduce((score, word) => (lower.includes(word) ? score + 1 : score), 0);
};

/**
 * Lightweight language detection (en / fr / rw). Falls back to English.
 */
const detectLanguage = (text = "") => {
    const sample = String(text || "").trim();
    if (!sample) return "en";

    const rwScore = scoreMarkers(sample, RW_MARKERS);
    const frScore = scoreMarkers(sample, FR_MARKERS);

    if (rwScore >= 2 && rwScore >= frScore) return "rw";
    if (frScore >= 2) return "fr";

    if (/[àâäéèêëïîôùûüçœæ]/i.test(sample) && frScore >= 1) return "fr";

    return "en";
};

const languageLabel = (code) => {
    switch (code) {
        case "rw": return "Kinyarwanda";
        case "fr": return "French";
        default: return "English";
    }
};

module.exports = { detectLanguage, languageLabel };

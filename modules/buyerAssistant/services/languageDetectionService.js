const RW_MARKERS = [
    "muraho", "mwiriwe", "amakuru", "urakoze", "murakoze", "yego", "oya", "ndashaka",
    "mwaramutse", "amahoro", "ubumwe", "icyo", "nyuma", "nfite", "mfite", "ngiye",
    "nshaka", "mbwira", "ubwo", "ibiciro", "igicuruzwa", "ibicuruzwa", "agakari",
    "amategeko", "serivisi", "gutanga", "kwishyura", "injira", "ufite", "nihe",
    "ryari", "kuki", "murakoze cyane", "ndabashaka", "mfashe", "ntazi", "waba",
    "ushobora", "ntacyo", "cyane", "mbega", "ndabona", "ndifuza", "mushobora",
];
const FR_MARKERS = [
    "bonjour", "merci", "salut", "comment", "livraison", "commande", "prix",
    "produit", "où", "quand", "je voudrais", "s'il vous plaît", "svp",
    "panier", "acheter", "combien", "bonsoir", "aide",
];

const scoreMarkers = (text, markers) => {
    const lower = String(text || "").toLowerCase();
    return markers.reduce((score, word) => {
        // Whole-word / phrase match to avoid English false positives (e.g. "ko" in "look").
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`(?:^|[^\\p{L}])${escaped}(?:$|[^\\p{L}])`, "iu");
        return re.test(lower) ? score + 1 : score;
    }, 0);
};

const normalizePreferredLanguage = (value) => {
    const code = String(value || "").trim().toLowerCase();
    if (code.startsWith("fr")) return "fr";
    if (code.startsWith("rw") || code.startsWith("kinya")) return "rw";
    return "en";
};

/**
 * Detect reply language from the message.
 * Prefers Kinyarwanda when clear RW cues appear; otherwise en/fr from text,
 * falling back to the platform preferred language (en/fr).
 */
const detectLanguage = (text = "", preferredLanguage = "en") => {
    const sample = String(text || "").trim();
    const preferred = normalizePreferredLanguage(preferredLanguage);

    if (!sample) return preferred === "rw" ? "en" : preferred;

    const rwScore = scoreMarkers(sample, RW_MARKERS);
    const frScore = scoreMarkers(sample, FR_MARKERS);

    // Kinyarwanda: answer in RW whenever the buyer writes in it (even short prompts).
    if (rwScore >= 1 && rwScore >= frScore) return "rw";
    if (frScore >= 2) return "fr";
    if (/[àâäéèêëïîôùûüçœæ]/i.test(sample) && frScore >= 1) return "fr";

    // Ambiguous / English-looking text → follow platform language when it is fr/en.
    if (preferred === "fr" || preferred === "en") return preferred;
    return "en";
};

const languageLabel = (code) => {
    switch (normalizePreferredLanguage(code)) {
        case "rw": return "Kinyarwanda";
        case "fr": return "French";
        default: return "English";
    }
};

module.exports = { detectLanguage, languageLabel, normalizePreferredLanguage };

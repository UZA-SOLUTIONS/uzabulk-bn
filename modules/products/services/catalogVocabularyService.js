const normalizeTerm = (value = "") =>
    String(value || "").toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();

const isLiveVocabularyEnabled = () =>
    String(process.env.CATALOG_VOCAB_LIVE_ENABLED ?? "true").toLowerCase() !== "false";

const GENERIC_EXPAND_TOKENS = new Set([
    "pink", "beige", "green", "olive", "black", "white", "blue", "red", "gray", "grey",
    "cotton", "silicone", "metal", "plastic", "leather", "wood",
    "solid", "basic", "modern", "standard", "smooth", "soft",
]);
const AMBIGUOUS_IDENTITY_TOKENS = new Set([
    "men", "mens", "man", "women", "womens", "woman",
    "black", "white", "brown", "blue", "red", "green", "yellow", "pink", "purple",
    "gold", "silver", "gray", "grey", "leather", "dress", "casual", "formal",
    "style", "design", "fashion",
]);
const FOOTWEAR_ANCHOR_TOKENS = new Set([
    "shoe", "shoes", "loafer", "loafers", "oxford", "oxfords", "brogue", "brogues",
    "wingtip", "boot", "boots", "sneaker", "sneakers", "slipper", "slippers",
    "sandal", "sandals", "footwear", "heel", "heels",
]);

const resolveIdentityAnchors = (identityTokens = new Set()) => {
    const anchors = new Set(
        [...identityTokens].filter((word) =>
            !GENERIC_EXPAND_TOKENS.has(word) && !AMBIGUOUS_IDENTITY_TOKENS.has(word)
        )
    );
    if ([...anchors].some((word) => FOOTWEAR_ANCHOR_TOKENS.has(word))) {
        FOOTWEAR_ANCHOR_TOKENS.forEach((word) => anchors.add(word));
        anchors.delete("dress");
    }
    return anchors;
};

const dedupeNeedles = (needles = [], max = 12, identityHints = {}) => {
    const identityText = [
        identityHints.productType,
        identityHints.primaryKeyword,
        identityHints.objectLabel,
        identityHints.searchPhrase,
    ].filter(Boolean).join(" ");
    const identityTokens = new Set(
        normalizeTerm(identityText)
            .split(" ")
            .filter((word) => word.length > 2 && !GENERIC_EXPAND_TOKENS.has(word))
    );
    const identityAnchors = resolveIdentityAnchors(identityTokens);

    const seen = new Set();
    const kept = [];

    (needles || []).forEach((needle) => {
        const key = normalizeTerm(needle);
        if (!key || key.length < 3 || seen.has(key)) return;

        const words = key.split(" ").filter(Boolean);
        if (words.every((word) => GENERIC_EXPAND_TOKENS.has(word))) return;

        // If we know the product identity, drop expansions that share none of it.
        if (identityTokens.size) {
            const hits = words.filter((word) => identityTokens.has(word)).length;
            const anchorHits = words.filter((word) => identityAnchors.has(word)).length;
            const isOriginalIdentity = words.some((word) => identityTokens.has(word))
                || key === normalizeTerm(identityHints.primaryKeyword)
                || key === normalizeTerm(identityHints.productType)
                || key === normalizeTerm(identityHints.objectLabel);
            if (!isOriginalIdentity && identityAnchors.size && anchorHits === 0) return;
            // Allow original needles even if short; reject extras with zero identity overlap.
            if (!isOriginalIdentity && hits === 0 && kept.length >= 3) return;
            if (!isOriginalIdentity && hits === 0 && words.length >= 2) return;
        }

        seen.add(key);
        kept.push(key);
    });

    // Keep input order (identity-first). Do NOT sort by shortest length.
    return kept.slice(0, max);
};

/**
 * Expand image-search needles using live Elasticsearch hits (no offline catalog scan).
 * Expansions must still agree with the scanned product identity (common sense).
 */
const expandNeedlesForImageSearch = async ({
    needles = [],
    primaryKeyword = "",
    searchPhrase = "",
    objectLabel = "",
    keywords = [],
    productType = "",
    identityHints = {},
    maxExtra = 3,
} = {}) => {
    const hints = {
        productType: productType || identityHints.productType || "",
        primaryKeyword: primaryKeyword || identityHints.primaryKeyword || "",
        objectLabel: objectLabel || identityHints.objectLabel || "",
        searchPhrase: searchPhrase || identityHints.searchPhrase || "",
    };

    if (!isLiveVocabularyEnabled()) {
        return dedupeNeedles(needles, 12, hints);
    }

    const { expandNeedlesFromLiveCatalog } = require("./catalogVocabularyLiveService");
    const expanded = await expandNeedlesFromLiveCatalog({
        needles,
        primaryKeyword: hints.primaryKeyword,
        searchPhrase: hints.searchPhrase,
        objectLabel: hints.objectLabel,
        keywords,
        productType: hints.productType,
        maxExtra,
    });

    return dedupeNeedles(expanded, 12, hints);
};

module.exports = {
    expandNeedlesForImageSearch,
    isLiveVocabularyEnabled,
};

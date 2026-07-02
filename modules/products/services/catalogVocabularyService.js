const normalizeTerm = (value = "") =>
    String(value || "").toLowerCase().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();

const isLiveVocabularyEnabled = () =>
    String(process.env.CATALOG_VOCAB_LIVE_ENABLED ?? "true").toLowerCase() !== "false";

const dedupeNeedles = (needles = [], max = 14) => {
    const seen = new Set();
    return (needles || []).filter((needle) => {
        const key = normalizeTerm(needle);
        if (!key || key.length < 3 || seen.has(key)) return false;
        seen.add(key);
        return true;
    }).sort((a, b) => a.length - b.length).slice(0, max);
};

/**
 * Expand image-search needles using live Elasticsearch hits (no offline catalog scan).
 */
const expandNeedlesForImageSearch = async ({
    needles = [],
    primaryKeyword = "",
    searchPhrase = "",
    objectLabel = "",
    keywords = [],
    maxExtra = 6,
} = {}) => {
    if (!isLiveVocabularyEnabled()) {
        return dedupeNeedles(needles);
    }

    const { expandNeedlesFromLiveCatalog } = require("./catalogVocabularyLiveService");
    const expanded = await expandNeedlesFromLiveCatalog({
        needles,
        primaryKeyword,
        searchPhrase,
        objectLabel,
        keywords,
        maxExtra,
    });

    return dedupeNeedles(expanded);
};

module.exports = {
    expandNeedlesForImageSearch,
    isLiveVocabularyEnabled,
};

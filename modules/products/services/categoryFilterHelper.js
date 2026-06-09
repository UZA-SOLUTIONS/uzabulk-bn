const mongoose = require("mongoose");

const CACHE_TTL_MS = 10 * 60 * 1000;
const expandCache = new Map();
let childrenByParent = null;
let childrenByParentAt = 0;

const looksLikeObjectId = (value) =>
    /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());

const toObjectIds = (ids = []) =>
    [...new Set(ids.map(String).filter(looksLikeObjectId))]
        .map((id) => new mongoose.Types.ObjectId(id));

const getCachedExpand = (key) => {
    const entry = expandCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
        expandCache.delete(key);
        return null;
    }
    return entry.ids;
};

const setCachedExpand = (key, ids) => {
    expandCache.set(key, { ids, expires: Date.now() + CACHE_TTL_MS });
};

const loadChildrenMap = async () => {
    if (childrenByParent && Date.now() - childrenByParentAt < CACHE_TTL_MS) {
        return childrenByParent;
    }

    const rows = await _model.Category.find({ status: "active" })
        .select("_id subcategories")
        .lean();

    const map = new Map();
    rows.forEach((row) => {
        const id = String(row._id);
        const children = (row.subcategories || [])
            .map((sub) => String(sub))
            .filter(looksLikeObjectId);
        map.set(id, children);
    });

    childrenByParent = map;
    childrenByParentAt = Date.now();
    return map;
};

const collectDescendantIds = (rootId, childrenMap) => {
    const ids = new Set([String(rootId)]);
    const queue = [String(rootId)];

    while (queue.length) {
        const current = queue.shift();
        const children = childrenMap.get(current) || [];
        children.forEach((childId) => {
            if (!ids.has(childId)) {
                ids.add(childId);
                queue.push(childId);
            }
        });
    }

    return [...ids];
};

/**
 * Category id plus all descendant category ids (for parent-tab filtering).
 */
const expandCategoryFilterIds = async (categoryId) => {
    const root = String(categoryId || "").trim();
    if (!root || !looksLikeObjectId(root)) return [];

    const cached = getCachedExpand(root);
    if (cached) return cached;

    const childrenMap = await loadChildrenMap();
    const ids = collectDescendantIds(root, childrenMap);
    setCachedExpand(root, ids);
    return ids;
};

/**
 * Mongo match for products in any of the given categories (array + tier fields).
 */
const buildMongoCategoryMatch = (categoryIds = []) => {
    const oids = toObjectIds(categoryIds);
    if (!oids.length) return null;

    return {
        $or: [
            { categories: { $in: oids } },
            { topCategoryId: { $in: oids } },
            { secondCategoryId: { $in: oids } },
            { thirdCategoryId: { $in: oids } },
        ],
    };
};

/**
 * Elasticsearch filter clause for category ids (keyword `categories` array).
 */
const buildEsCategoryFilter = (categoryIds = []) => {
    const strIds = [...new Set(categoryIds.map(String).filter(looksLikeObjectId))];
    if (!strIds.length) return null;

    return {
        terms: { categories: strIds },
    };
};

module.exports = {
    expandCategoryFilterIds,
    buildMongoCategoryMatch,
    buildEsCategoryFilter,
};

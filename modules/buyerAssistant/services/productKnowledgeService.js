const Product = require("../../../models/productsTable");
const { isValidObjectId } = require("../../../validators/validator");
const { buildProductCard } = require("./assistantEnrichmentService");
const { isBlockedCatalogProduct } = require("../../products/helpers/catalogVisibilityHelper");
const {
    withTimeout,
    isFastMode,
    vectorSearchEnabled,
    needsProductSearch,
} = require("./buyerAssistantUtils");
const {
    stripIntentPrefixes,
    normalizeProductTypos,
    extractProductTokens,
} = require("./assistantIntentService");
const { filterAssistantSearchProducts } = require("./assistantProductSearchHelper");

const PRODUCT_SELECT =
    "name slug price compare_price short_description description status stock_status min_order_qty price_tiers offerId sku average_rating rating_count sold_count supplier_rating categories featured_image images";

const populateProductMedia = async (docs = []) => {
    const list = Array.isArray(docs) ? docs : [docs];
    if (!list.length) return list;
    try {
        await Product.populate(list, { path: "featured_image", select: "link -_id" });
    } catch {
        // optional
    }
    return list;
};

const extractProductRef = (text = "") => {
    const sample = String(text || "");
    const objectIdMatch = sample.match(/\b([a-f0-9]{24})\b/i);
    if (objectIdMatch?.[1] && isValidObjectId(objectIdMatch[1])) {
        return { type: "id", value: objectIdMatch[1] };
    }
    const offerMatch = sample.match(/\b(\d{10,16})\b/);
    if (offerMatch?.[1]) {
        return { type: "offerId", value: offerMatch[1] };
    }
    return null;
};

const formatPriceTiers = (tiers = []) => {
    if (!Array.isArray(tiers) || !tiers.length) return "";
    return tiers
        .slice(0, 3)
        .map((tier) => {
            const qty = tier.startQuantity || tier.minQty || "?";
            return `${qty}+ units: ${tier.price}`;
        })
        .join("; ");
};

const buildProductChunkFromDoc = (product, score = 1) => {
    if (!product) return null;

    const moq = product.min_order_qty || product.minQuantity || product.moq;
    const tierText = formatPriceTiers(product.price_tiers);
    const desc = String(product.short_description || product.description || "").trim();

    const lines = [
        `Product: ${product.name}`,
        product.slug ? `Catalog slug: ${product.slug}` : "",
        `Price: ${product.price}`,
        product.compare_price ? `Compare at: ${product.compare_price}` : "",
        `Status: ${product.status}`,
        product.stock_status ? `Stock: ${product.stock_status}` : "",
        moq ? `MOQ: ${moq}` : "",
        tierText ? `Wholesale tiers: ${tierText}` : "",
        product.sku ? `SKU: ${product.sku}` : "",
        product.offerId ? `1688 offer ID: ${product.offerId}` : "",
        product.average_rating != null ? `Rating: ${product.average_rating} (${product.rating_count || 0} reviews)` : "",
        product.sold_count != null ? `Sold count: ${product.sold_count}` : "",
        product.supplier_rating != null ? `Supplier rating: ${product.supplier_rating}` : "",
        desc ? `Description: ${desc.slice(0, 600)}` : "",
        product._id ? `Product ID: ${product._id}` : "",
    ].filter(Boolean);

    return {
        source: "product_docs",
        title: product.name,
        text: lines.join("\n"),
        score,
        productId: String(product._id),
        productCard: buildProductCard(product),
    };
};

const fetchProductByRef = async (ref) => {
    if (!ref?.value) return null;
    let product = null;
    if (ref.type === "id" && isValidObjectId(ref.value)) {
        product = await Product.findById(ref.value).select(PRODUCT_SELECT).lean();
    } else if (ref.type === "offerId") {
        product = await Product.findOne({ offerId: String(ref.value), status: "active" })
            .select(PRODUCT_SELECT)
            .lean();
    }
    if (!product) return null;
    await populateProductMedia(product);
    return product;
};

const fetchProductById = async (productId) => {
    if (!productId || !isValidObjectId(productId)) return null;
    const product = await Product.findById(productId).select(PRODUCT_SELECT).lean();
    if (!product) return null;
    await populateProductMedia(product);
    return product;
};

const escapeRegex = (value = "") =>
    String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const searchProductsByNameNeedle = async (query, limit = 3) => {
    const cleaned = normalizeProductTypos(stripIntentPrefixes(String(query || "").trim()));
    if (!cleaned || cleaned.length < 2) return [];

    const tokens = extractProductTokens(query);
    const cap = Math.max(Number(limit) || 3, 1);

    try {
        const { searchCatalogByText } = require("../../products/services/catalogSearchService");
        const catalogResult = await withTimeout(
            searchCatalogByText({
                search: cleaned,
                limit: cap,
                skip: 1,
                skipExternal: true,
            }),
            isFastMode() ? 3500 : 6000,
            { items: [] }
        );
        if (catalogResult?.items?.length) {
            await populateProductMedia(catalogResult.items);
            return filterAssistantSearchProducts(catalogResult.items, cleaned, { limit: cap });
        }
    } catch (error) {
        console.warn("[buyer-assistant] catalog name search failed:", error?.message || error);
    }

    const searchTokens = tokens.length ? tokens : cleaned.split(/\s+/).filter((w) => w.length >= 2);
    if (!searchTokens.length) return [];

    try {
        const andClauses = searchTokens.map((token) => ({
            name: { $regex: escapeRegex(token), $options: "i" },
        }));

        let items = await Product.find({
            status: "active",
            $and: andClauses,
        })
            .select(PRODUCT_SELECT)
            .sort({ sold_count: -1, average_rating: -1 })
            .limit(cap)
            .lean();

        if (!items.length && searchTokens.length > 1) {
            items = await Product.find({
                status: "active",
                name: {
                    $regex: escapeRegex(searchTokens.slice(0, 2).join(".*")),
                    $options: "i",
                },
            })
                .select(PRODUCT_SELECT)
                .sort({ sold_count: -1, average_rating: -1 })
                .limit(cap)
                .lean();
        }

        if (!items.length && searchTokens.length === 1) {
            items = await Product.find({
                status: "active",
                name: { $regex: escapeRegex(searchTokens[0]), $options: "i" },
            })
                .select(PRODUCT_SELECT)
                .sort({ sold_count: -1, average_rating: -1 })
                .limit(cap)
                .lean();
        }

        await populateProductMedia(items);
        return filterAssistantSearchProducts(items, cleaned, { limit: cap });
    } catch {
        return [];
    }
};

const resolveProductChunksForQuery = async ({
    query,
    queryVector,
    productId,
    vectorSearchFn,
    limit = 3,
} = {}) => {
    const chunks = [];
    const seen = new Set();
    const cap = Math.min(Math.max(Number(limit) || 3, 1), 4);

    const ingest = (product, score) => {
        if (isBlockedCatalogProduct(product)) return;
        const chunk = buildProductChunkFromDoc(product, score);
        if (!chunk) return;
        const key = chunk.productId || chunk.title;
        if (seen.has(key)) return;
        seen.add(key);
        chunks.push(chunk);
    };

    const ref = extractProductRef(query);
    const [explicit, refProduct] = await Promise.all([
        fetchProductById(productId),
        fetchProductByRef(ref),
    ]);

    if (explicit) ingest(explicit, 2);
    if (refProduct) ingest(refProduct, 1.9);

    if (chunks.length >= cap) {
        return chunks.slice(0, cap);
    }

    if (!needsProductSearch(query, productId)) {
        return chunks.slice(0, cap);
    }

    const nameItems = await withTimeout(
        searchProductsByNameNeedle(query, cap - chunks.length),
        isFastMode() ? 2500 : 5000,
        []
    );
    nameItems.forEach((item, index) => ingest(item, 0.95 - index * 0.05));

    if (
        vectorSearchEnabled()
        && queryVector
        && typeof vectorSearchFn === "function"
        && chunks.length < cap
    ) {
        const vectorItems = await withTimeout(
            vectorSearchFn(queryVector, {
                limit: cap - chunks.length,
                minScore: 0.14,
                candidateLimit: Math.min(
                    Number(process.env.BUYER_ASSISTANT_VECTOR_CANDIDATES || 48),
                    80
                ),
                populateFeaturedImage: false,
            }),
            2500,
            []
        );
        vectorItems.forEach((item) => ingest(item, item.similarity_score || 0.7));
    }

    return chunks.slice(0, cap);
};

module.exports = {
    extractProductRef,
    buildProductChunkFromDoc,
    fetchProductByRef,
    fetchProductById,
    resolveProductChunksForQuery,
};

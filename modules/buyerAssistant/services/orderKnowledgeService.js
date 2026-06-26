const { isValidObjectId } = require("../../../validators/validator");
const Product = require("../../../models/productsTable");
const { buildProductCard } = require("./assistantEnrichmentService");
const { buildProductChunkFromDoc } = require("./productKnowledgeService");

const PRODUCT_SELECT =
    "name slug price compare_price short_description description status stock_status min_order_qty price_tiers offerId sku average_rating rating_count featured_image images";

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

/** Flat cart line items or nested checkout line_items groups. */
const normalizeOrderLineItems = (lineItems) => {
    if (!lineItems) return [];

    if (Array.isArray(lineItems)) {
        if (lineItems.length && Array.isArray(lineItems[0]?.items)) {
            return lineItems.flatMap((group) => group.items || []);
        }
        return lineItems.filter((item) => item && (item.productName || item.name || item.product));
    }

    if (typeof lineItems === "object" && Array.isArray(lineItems.items)) {
        return lineItems.items;
    }

    return [];
};

const lineItemProductId = (item = {}) => {
    const raw = item.product || item.productId || item._id;
    if (!raw) return "";
    const id = String(raw);
    return isValidObjectId(id) ? id : "";
};

const formatLineItemRow = (item = {}, index = 0) => {
    const name = item.productName || item.name || "Product";
    const qty = item.quantity || 0;
    const unit = item.unitPrice ?? item.price ?? "";
    const line = item.amount ?? item.lineTotal ?? "";
    const productId = lineItemProductId(item);
    const parts = [`${index + 1}. ${qty}x ${name}`];
    if (unit !== "") parts.push(`unit ${unit}`);
    if (line !== "") parts.push(`line ${line}`);
    if (productId) parts.push(`product ID ${productId}`);
    if (item.sku_id) parts.push(`SKU ${item.sku_id}`);
    if (item.offerId) parts.push(`offer ${item.offerId}`);
    if (Array.isArray(item.attributes) && item.attributes.length) {
        const attrs = item.attributes
            .map((attr) => `${attr.attrName || "option"}: ${attr.attrValue || ""}`)
            .filter(Boolean)
            .join(", ");
        if (attrs) parts.push(attrs);
    }
    return parts.join(" | ");
};

const buildOrderLineItemsText = (order = {}) => {
    const items = normalizeOrderLineItems(order.line_items);
    if (!items.length) return "";

    const header = `Ordered products (${items.length}):`;
    const rows = items.slice(0, 12).map((item, index) => formatLineItemRow(item, index));
    if (items.length > 12) rows.push(`…and ${items.length - 12} more line items`);
    return [header, ...rows].join("\n");
};

const buildProductCardFromLineItem = (item = {}, productDoc = null) => {
    const productId = lineItemProductId(item);
    if (productDoc) {
        const card = buildProductCard(productDoc);
        if (card) {
            card.quantityOrdered = item.quantity || null;
            card.lineTotal = item.amount ?? item.lineTotal ?? null;
            card.fromOrder = true;
        }
        return card;
    }

    if (!productId) return null;

    return {
        id: productId,
        name: item.productName || item.name || "Product",
        price: item.unitPrice ?? item.price ?? null,
        imageUrl: item.productImage || "",
        quantityOrdered: item.quantity || null,
        lineTotal: item.amount ?? item.lineTotal ?? null,
        offerId: item.offerId ? String(item.offerId) : "",
        fromOrder: true,
    };
};

const fetchProductsForLineItems = async (lineItems = []) => {
    const ids = [...new Set(lineItems.map(lineItemProductId).filter(Boolean))];
    if (!ids.length) return new Map();

    const products = await Product.find({ _id: { $in: ids }, status: "active" })
        .select(PRODUCT_SELECT)
        .lean();
    await populateProductMedia(products);

    const byId = new Map();
    products.forEach((doc) => byId.set(String(doc._id), doc));
    return byId;
};

const buildOrderProductChunks = async (order) => {
    if (!order) return [];

    const lineItems = normalizeOrderLineItems(order.line_items);
    if (!lineItems.length) return [];

    const productMap = await fetchProductsForLineItems(lineItems);
    const chunks = [];
    const seen = new Set();

    for (const item of lineItems.slice(0, 6)) {
        const productId = lineItemProductId(item);
        const productDoc = productId ? productMap.get(productId) : null;
        const card = buildProductCardFromLineItem(item, productDoc);
        const chunk = productDoc
            ? buildProductChunkFromDoc(productDoc, 1.9)
            : null;

        if (chunk) {
            chunk.productCard = card || chunk.productCard;
            chunk.source = "order_products";
            chunk.title = `${order.customOrderId || order._id}: ${chunk.title}`;
            chunk.score = 1.95;
        } else if (card?.id && isValidObjectId(card.id)) {
            const text = [
                `Product: ${card.name}`,
                card.quantityOrdered ? `Ordered qty: ${card.quantityOrdered}` : "",
                card.price != null ? `Unit price: ${card.price}` : "",
                card.lineTotal != null ? `Line total: ${card.lineTotal}` : "",
                `Product ID: ${card.id}`,
            ].filter(Boolean).join("\n");

            chunks.push({
                source: "order_products",
                title: `${order.customOrderId || order._id}: ${card.name}`,
                text,
                score: 1.85,
                productId: card.id,
                productCard: card,
            });
            continue;
        } else {
            continue;
        }

        const key = chunk.productId || chunk.title;
        if (seen.has(key)) continue;
        seen.add(key);
        chunks.push(chunk);
    }

    return chunks;
};

const buildOrderLineItemsChunk = (order) => {
    const text = buildOrderLineItemsText(order);
    if (!text) return null;

    return {
        source: "order_products",
        title: `Products in order ${order.customOrderId || order._id}`,
        text,
        score: 2.1,
        orderId: String(order._id),
    };
};

module.exports = {
    normalizeOrderLineItems,
    buildOrderLineItemsText,
    buildOrderProductChunks,
    buildOrderLineItemsChunk,
    buildProductCardFromLineItem,
    lineItemProductId,
};

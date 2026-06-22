const Product = require("../../../models/productsTable");

const META_WAN_IMAGE = "wan_enhanced_image";
const META_WAN_STATUS = "wan_enhance_status";

const isWanEnhanceEnabled = () => {
    const flag = String(process.env.DASHSCOPE_WAN_ENHANCE ?? "false").toLowerCase();
    return flag === "1" || flag === "true";
};

const upsertMeta = (metaData = [], entries = {}) => {
    const map = new Map(
        (metaData || []).map((row) => [String(row.key), String(row.value ?? "")])
    );
    Object.entries(entries).forEach(([key, value]) => {
        if (value == null || value === "") return;
        map.set(key, String(value));
    });
    return [...map.entries()].map(([key, value]) => ({ key, value }));
};

/**
 * Background WAN image enhancement — non-blocking catalog upgrade.
 * Shows original CDN image immediately; swaps when callback completes.
 */
const queueWanImageEnhancement = async (productId, imageUrl) => {
    if (!isWanEnhanceEnabled()) {
        return { skipped: true, reason: "disabled" };
    }

    const url = String(imageUrl || "").trim();
    if (!url || !productId) {
        return { skipped: true, reason: "missing_input" };
    }

    const product = await Product.findById(productId)
        .select("meta_data featured_image images")
        .lean();

    if (!product) {
        return { skipped: true, reason: "not_found" };
    }

    const existing = (product.meta_data || []).find((row) => row?.key === META_WAN_IMAGE);
    if (existing?.value) {
        return { skipped: true, reason: "already_enhanced" };
    }

    await Product.updateOne(
        { _id: productId },
        {
            $set: {
                meta_data: upsertMeta(product.meta_data, {
                    [META_WAN_STATUS]: "queued",
                    wan_enhance_source: url,
                }),
            },
        }
    );

    // WAN T2I integration point — replace with DashScope async job when API is wired.
    console.info(`[wan-enhance] queued product ${productId} (source image ready for async swap)`);

    return { queued: true, productId: String(productId) };
};

module.exports = {
    isWanEnhanceEnabled,
    queueWanImageEnhancement,
    META_WAN_IMAGE,
    META_WAN_STATUS,
};

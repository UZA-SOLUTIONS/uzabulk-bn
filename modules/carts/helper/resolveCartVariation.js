const productModel = require("../../../models/productsTable");
const productVariation = require("../../../models/productVariationTable");
const { getProductDetail } = require("../../products/services/alibaba");
const { updateProductDetails } = require("../../products/helper/migration");
const { syncVariationsFromFeatureAttribute } = require("../../products/helper/featureAttributeVariations");

const isRuntimeSupplierSyncEnabled = () =>
    String(process.env.RUNTIME_SUPPLIER_SYNC_ENABLED ?? "false").toLowerCase() === "true";

const asIdList = (value) => {
    if (!Array.isArray(value)) return [];
    return value.map((id) => (id && id._id ? id._id : id)).filter(Boolean);
};

const isVariationInStock = (variation) => {
    if (!variation) return false;
    if (!variation.manage_stock && variation.stock_status === "outofstock") return false;
    if (variation.manage_stock && Number(variation.stock_quantity) <= 0) return false;
    return true;
};

const loadVariations = async (product) => {
    const ids = asIdList(product?.variations);
    if (!ids.length) return [];
    const rows = await productVariation.find({ _id: { $in: ids } }).lean();
    const byId = new Map(rows.map((row) => [String(row._id), row]));
    return ids.map((id) => byId.get(String(id))).filter(Boolean);
};

const demoteProductToSimple = async (productId) => {
    if (!productId) return null;
    return productModel.findOneAndUpdate(
        { _id: productId },
        {
            type: "simple",
            variations: [],
            attributes: [],
            last_updated: new Date(),
        },
        { new: true, lean: true }
    );
};

const syncProductVariations = async (product) => {
    const productId = product?._id;
    const offerId = product?.offerId;
    if (!productId) return null;

    if (offerId && isRuntimeSupplierSyncEnabled()) {
        try {
            const productDetails = await getProductDetail(offerId);
            if (productDetails?.status && productDetails.status !== "published") {
                return null;
            }
            const skuCount = Array.isArray(productDetails?.productSkuInfos)
                ? productDetails.productSkuInfos.length
                : 0;
            if (productDetails?.status === "published" && skuCount > 0) {
                await updateProductDetails(product, productDetails);
                return productModel.findById(productId).lean();
            }
            if (productDetails?.status === "published" && skuCount === 0) {
                return demoteProductToSimple(productId);
            }
        } catch (error) {
            console.warn(`Cart variation sync failed for offerId=${offerId}:`, error.message);
        }
    }

    const full = await productModel
        .findById(productId)
        .select("featureAttribute price stock_quantity stock_status manage_stock vendor offerId variations type attributes")
        .lean();
    if (full?.featureAttribute?.length) {
        const synced = await syncVariationsFromFeatureAttribute(full);
        if (synced) {
            return productModel.findById(productId).lean();
        }
    }

    return full || product;
};

/**
 * Resolve a variation for variable products when the client omits variation_id
 * (common when SKU options failed to hydrate on the PDP).
 */
const resolveCartVariation = async (product, item = {}) => {
    if (product?.type === "simple") {
        return { product, variation: null, treatedAsSimple: true };
    }

    let workingProduct = product;
    let variations = await loadVariations(workingProduct);

    if (!variations.length) {
        const syncedProduct = await syncProductVariations(workingProduct);
        if (syncedProduct) {
            workingProduct = syncedProduct;
            if (workingProduct.type === "simple") {
                return { product: workingProduct, variation: null, treatedAsSimple: true };
            }
            variations = await loadVariations(workingProduct);
        }
    }

    if (!variations.length) {
        // Last resort: allow purchase as simple so catalog items are not blocked.
        const demoted = await demoteProductToSimple(workingProduct._id);
        return {
            product: demoted || { ...workingProduct, type: "simple" },
            variation: null,
            treatedAsSimple: true,
        };
    }

    let variation = null;
    if (item?.variation_id) {
        variation = variations.find((row) => String(row._id) === String(item.variation_id));
        if (!variation) {
            variation = await productVariation.getproductVariationById(item.variation_id);
        }
        if (!variation) {
            throw "PRODUCT_VARIATION_IS_INVALID";
        }
        return { product: workingProduct, variation, treatedAsSimple: false };
    }

    // Prefer an in-stock SKU when the client omitted variation_id (broken PDP options).
    const inStock = variations.filter(isVariationInStock);
    variation = inStock[0] || variations[0];

    return { product: workingProduct, variation, treatedAsSimple: false };
};

module.exports = {
    resolveCartVariation,
    syncProductVariations,
    demoteProductToSimple,
};

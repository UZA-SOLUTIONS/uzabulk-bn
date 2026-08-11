const { getProductDetail } = require('../services/alibaba');
const { extractMinOrderQty } = require('./moq');
const { extractSupplierIds } = require('./supplier');
const {
    extractSupplierRatingStats,
    getLocalReviewRatingStats,
    resolveProductRatingStats,
} = require('./ratings');
const { verifyFromProductDetails } = require('../services/supplierVerificationService');
const { ensureProductEmbedding } = require('../services/similarProductsService');
const { autoEnrichProductListing } = require('../../ai/services/autoSmartListingService');
const { bulkInsert } = require("../../../elasticsearch/indexes/productIndex");
const {
    transformPriceRange,
    resolveProductListPrice,
} = require('./pricing');
const { syncVariationsFromFeatureAttribute } = require('./featureAttributeVariations');
const STORE_TYPE_ID = "660e3c271095513081ed2223";
const DEFAULT_VENDOR_ID = "6625f5426b433d206e538ec2";

const asArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    return [value];
};

const updateProductDetails = async (product, productDetails) => {
    try {
        let productObject = {};
        let supplierIds = {};
        const existingId = product?._id || null;
        const offerIdLabel = product?.offerId || productDetails?.offerId;
        console.log("Product Processing to fetch latest - ", offerIdLabel);

        if (productDetails && productDetails.status == "published") {

            const {
                topCategoryId = "",
                secondCategoryId,
                thirdCategoryId,
                status,
                productSkuInfos,
                subject,
                subjectTrans,
                offerId,
                description,
                productSaleInfo,
                productImage,
                soldOut,
                productAttribute,
                mainVideo,
                detailVideo,
                productShippingInfo,
            } = productDetails;
            const price_tiers = transformPriceRange(productSaleInfo?.priceRangeList || []);
            const listPrice = resolveProductListPrice({
                price_tiers,
                productSkuInfos,
            });
            const min_order_qty = extractMinOrderQty(productDetails);
            supplierIds = extractSupplierIds(productDetails);
            const offerKey = String(offerId || product?.offerId || "").trim();
            const vendorId = product?.vendor || DEFAULT_VENDOR_ID;

            let variations = await transformAndInsertProductSKUs(vendorId, productSkuInfos, offerKey);

            const [categories, localRatingStats] = await Promise.all([
                _model.Category.getExternalCategory([topCategoryId, secondCategoryId, thirdCategoryId]),
                getLocalReviewRatingStats(existingId),
            ]);
            const supplierStats = extractSupplierRatingStats(productDetails);
            const ratingStats = resolveProductRatingStats(localRatingStats, {
                ...product,
                supplier_rating: supplierStats.average_rating,
                supplier_rating_count: supplierStats.rating_count,
            });

            productObject = {
                status: status === "published" ? "active" : "inactive",
                categories: categories.map((i) => i._id),
                topCategoryId: categories[0]?._id,
                secondCategoryId: categories[1]?._id,
                thirdCategoryId: categories[2]?._id,
                attributes: variations.attributes,
                variations: variations.variations,
                externalProduct: existingId,
                offerId: offerKey,
                storeType: STORE_TYPE_ID,
                vendor: DEFAULT_VENDOR_ID,
                name: subjectTrans || "",
                type: variations.variations.length ? "variable" : "simple",
                isFeatured: "no",
                short_description: "",
                ...(description ? { description } : {}),
                sku: "",
                price: listPrice,
                compare_price: 0,
                manage_stock: Boolean(productSaleInfo?.amountOnSale),
                bestSeller: "yes",
                stock_quantity: productSaleInfo?.amountOnSale,
                pricingType: productSaleInfo?.unitInfo?.transUnit,
                stock_status: "instock",
                featured_image: productImage?.images?.[0],
                images: productImage?.images,
                average_rating: ratingStats.average_rating,
                rating_count: ratingStats.rating_count,
                supplier_rating: supplierStats.average_rating,
                supplier_rating_count: supplierStats.rating_count,
                sold_count: soldOut,
                shippingCharge: 0,
                price_tiers,
                ...(min_order_qty != null ? { min_order_qty } : {}),
                featureAttribute: productAttribute,
                productVideos: {
                    main: mainVideo,
                    detail: detailVideo,
                },
                adminSold: true,
                external: true,
                sellerOpenId: supplierIds.sellerOpenId,
                seller_id: supplierIds.seller_id,
                supplier_id: supplierIds.supplier_id,
                productShippingInfo,
                last_updated: new Date(),
                meta_data: [
                    ...(product?.meta_data || []).filter((row) => row?.key !== "source_subject_cn"),
                    ...((subject || subjectTrans)
                        ? [{
                            key: "source_subject_cn",
                            value: String(subject || subjectTrans),
                        }]
                        : []),
                ],
            };

        } else {
            productObject = { deleted_at: new Date(), status: "active", last_updated: new Date() };
        }

        let updateProduct;
        if (existingId) {
            updateProduct = await _model.Product.findOneAndUpdate(
                { _id: existingId },
                productObject,
                { new: true }
            );
        } else {
            updateProduct = (await _model.Product.insertMany([productObject]))[0];
        }

        if (!updateProduct) {
            console.error(`Product save failed for offerId=${offerIdLabel}`);
            return null;
        }

        // If SKUs were empty, rebuild selectable options from feature attributes.
        if (
            (!Array.isArray(updateProduct.variations) || !updateProduct.variations.length)
            && asArray(productDetails?.productAttribute).length
        ) {
            const rebuilt = await syncVariationsFromFeatureAttribute(
                updateProduct.toObject?.() || updateProduct
            );
            if (rebuilt) {
                updateProduct = await _model.Product.findById(updateProduct._id);
            }
        }

        await bulkInsert([updateProduct]);
        console.log(
            `Product Updated Completed offerId=${updateProduct.offerId} type=${updateProduct.type} variations=${Array.isArray(updateProduct.variations) ? updateProduct.variations.length : 0}`
        );

        if (supplierIds.sellerOpenId || supplierIds.supplier_id || supplierIds.seller_id) {
            verifyFromProductDetails(productDetails, supplierIds).catch((verifyErr) => {
                console.warn(
                    `Supplier verification skipped for offerId=${offerIdLabel}:`,
                    verifyErr?.message || verifyErr
                );
            });
        }

        autoEnrichProductListing(updateProduct._id)
            .then((result) => {
                if (result?.skipped) {
                    return ensureProductEmbedding(updateProduct._id);
                }
                return null;
            })
            .catch((aiErr) => {
                console.warn(
                    `Auto smart listing failed for offerId=${offerIdLabel}:`,
                    aiErr?.message || aiErr
                );
                return ensureProductEmbedding(updateProduct._id);
            })
            .catch((embedErr) => {
                console.warn(
                    `Product embedding skipped for offerId=${offerIdLabel}:`,
                    embedErr?.message || embedErr
                );
            });

        return updateProduct;
    } catch (error) {
        console.error(`Error processing product ${product?._id}:`, error);
        return null;
    }
};

const transformAndInsertProductSKUs = async (vendor, productSkuInfos, offerId = "") => {
    const skuList = asArray(productSkuInfos);
    if (!skuList.length) {
        return { variations: [], attributes: [] };
    }

    const variationAttributes = {};
    const variationIds = [];
    const attributes = {};
    const vendorId = vendor || DEFAULT_VENDOR_ID;

    for (let index = 0; index < skuList.length; index += 1) {
        const skuInfo = skuList[index] || {};
        const productVariationAttributes = [];
        const skuAttributes = asArray(
            skuInfo?.skuAttributes || skuInfo?.attributes || skuInfo?.skuAttributesList
        );

        for (const attr of skuAttributes) {
            if (!attr?.attributeId && !attr?.attributeNameTrans && !attr?.attributeName && !attr?.name) {
                continue;
            }

            const attributeKey = attr.attributeId || attr.attributeNameTrans || attr.attributeName || attr.name;
            const attributeName = attr.attributeNameTrans || attr.attributeName || attr.name || String(attributeKey);
            let attribute = attributes[attributeKey] ||
                await _model.Attribute.findOneAndUpdate(
                    { externalAttrId: attributeKey, name: attributeName, vendor: vendorId },
                    {
                        externalAttrId: attributeKey,
                        storeType: STORE_TYPE_ID,
                        vendor: vendorId,
                        name: attributeName,
                        status: "active",
                    },
                    { new: true, upsert: true }
                );

            attributes[attributeKey] = attribute;

            const termName = attr.valueTrans || attr.value || attr.valueName || "Default";
            const term = await _model.AttributeTerm.findOneAndUpdate(
                { attribute: attribute._id, name: termName },
                {
                    vendor: vendorId,
                    image: attr.skuImageUrl || attr.imageUrl || "",
                    attribute: attribute._id,
                    name: termName,
                    status: "active",
                },
                { new: true, upsert: true }
            );

            if (!variationAttributes[attribute._id]) {
                variationAttributes[attribute._id] = {
                    _id: attribute._id,
                    name: attributeName,
                    terms: [],
                };
            }

            if (!variationAttributes[attribute._id].terms.find((termItem) => termItem._id.equals(term._id))) {
                variationAttributes[attribute._id].terms.push({
                    _id: term._id,
                    name: termName,
                    image: attr.skuImageUrl || attr.imageUrl || "",
                });
            }

            productVariationAttributes.push({ _id: term._id, name: termName });
        }

        const skuId = String(
            skuInfo.skuId ||
            skuInfo.skuID ||
            skuInfo.specId ||
            skuInfo.specID ||
            `${offerId || "sku"}-${index + 1}`
        );
        const specId = String(
            skuInfo.specId || skuInfo.specID || skuInfo.skuId || skuInfo.skuID || skuId
        );

        const productVariation = {
            specId,
            skuId,
            description: skuInfo.description || "",
            image: skuInfo.image || skuInfo.skuImageUrl || "",
            sku: skuInfo.sku || skuInfo.skuCode || skuId,
            price: Number(skuInfo.consignPrice || skuInfo.price || skuInfo.salePrice || 0) || 0,
            compare_price: Number(skuInfo.consignPrice || skuInfo.price || skuInfo.salePrice || 0) || 0,
            manage_stock: true,
            stock_quantity: Number(skuInfo.amountOnSale || skuInfo.stock || skuInfo.quantity || 0) || 0,
            stock_status:
                Number(skuInfo.amountOnSale || skuInfo.stock || skuInfo.quantity || 0) > 0
                    ? "instock"
                    : "outofstock",
            attributes: productVariationAttributes,
        };

        const newProductVariation = await _model.productVariation.findOneAndUpdate(
            { skuId },
            productVariation,
            { new: true, upsert: true }
        );

        variationIds.push(newProductVariation._id);
    }

    return {
        variations: variationIds,
        attributes: Object.values(variationAttributes),
    };
};

module.exports = { updateProductDetails };

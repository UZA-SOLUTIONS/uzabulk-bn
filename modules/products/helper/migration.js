const _ = require("lodash")
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
const STORE_TYPE_ID = "660e3c271095513081ed2223";

const updateProductDetails = async (product, productDetails) => {
    try {
        let productObject = {};
        let supplierIds = {};
        console.log("Product Processing to fetch latest - ", product.offerId);

        if (productDetails && productDetails.status == "published") {

            const { topCategoryId = "", secondCategoryId, thirdCategoryId, status, productSkuInfos, subject, subjectTrans, offerId, description, productSaleInfo, productImage, soldOut, productAttribute, mainVideo, detailVideo, productShippingInfo } = productDetails;
            const price_tiers = transformPriceRange(productSaleInfo?.priceRangeList || []);
            const min_order_qty = extractMinOrderQty(productDetails);
            supplierIds = extractSupplierIds(productDetails);

            const [categories, variations, localRatingStats] = await Promise.all([
                _model.Category.getExternalCategory([topCategoryId, secondCategoryId, thirdCategoryId]),
                transformAndInsertProductSKUs(product.vendor, productSkuInfos),
                getLocalReviewRatingStats(product._id)
            ]);
            const supplierStats = extractSupplierRatingStats(productDetails);
            const ratingStats = resolveProductRatingStats(localRatingStats, {
                ...product,
                supplier_rating: supplierStats.average_rating,
                supplier_rating_count: supplierStats.rating_count,
            });

            productObject = {
                status: status === "published" ? "active" : "inactive",
                categories: categories.map(i => i._id),
                topCategoryId: categories[0]?._id,
                secondCategoryId: categories[1]?._id,
                thirdCategoryId: categories[2]?._id,
                attributes: variations.attributes,
                variations: variations.variations,

                // update basic details
                externalProduct: product._id,
                offerId: offerId,
                storeType: "660e3c271095513081ed2223",
                vendor: "6625f5426b433d206e538ec2",
                name: subjectTrans || "",
                type: productSkuInfos?.length ? "variable" : "simple",
                isFeatured: "no",
                short_description: "",
                ...(description ? { description } : {}),
                sku: "", // Consider adding SKU logic if needed
                price: price_tiers[0]?.price,
                compare_price: 0,
                manage_stock: Boolean(productSaleInfo.amountOnSale),
                bestSeller: "yes",
                stock_quantity: productSaleInfo.amountOnSale,
                pricingType: productSaleInfo?.unitInfo?.transUnit,
                stock_status: "instock",
                featured_image: productImage?.images[0],
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
                    detail: detailVideo
                },
                adminSold: true,
                external: true,
                sellerOpenId: supplierIds.sellerOpenId,
                seller_id: supplierIds.seller_id,
                supplier_id: supplierIds.supplier_id,
                productShippingInfo,
                last_updated: new Date(),
                meta_data: [
                    ...(product.meta_data || []).filter((row) => row?.key !== "source_subject_cn"),
                    ...((subject || subjectTrans) ? [{
                        key: "source_subject_cn",
                        value: String(subject || subjectTrans),
                    }] : []),
                ],
            };

        } else productObject = { deleted_at: new Date(), status: "active", last_updated: new Date() };

        const updateProduct = await _model.Product.findOneAndUpdate({ _id: product._id }, productObject, { new: true });
        await bulkInsert([updateProduct]);
        console.log("Product Updated Completed");

        if (supplierIds.sellerOpenId || supplierIds.supplier_id || supplierIds.seller_id) {
            verifyFromProductDetails(productDetails, supplierIds).catch((verifyErr) => {
                console.warn(
                    `Supplier verification skipped for offerId=${offerId}:`,
                    verifyErr?.message || verifyErr
                );
            });
        }

        autoEnrichProductListing(product._id)
            .then((result) => {
                if (result?.skipped) {
                    return ensureProductEmbedding(product._id);
                }
                return null;
            })
            .catch((aiErr) => {
                console.warn(
                    `Auto smart listing failed for offerId=${offerId}:`,
                    aiErr?.message || aiErr
                );
                return ensureProductEmbedding(product._id);
            })
            .catch((embedErr) => {
                console.warn(
                    `Product embedding skipped for offerId=${offerId}:`,
                    embedErr?.message || embedErr
                );
            });

    } catch (error) { console.error(`Error processing product ${product._id}:`, error); };
};

const transformAndInsertProductSKUs = async (vendor, productSkuInfos) => {
    if (!productSkuInfos) {
        return { variations: [], attributes: [] };
    }

    const variationAttributes = {};
    const variationIds = [];
    const attributes = {};

    const skuPromises = productSkuInfos.map(async (skuInfo) => {
        const productVariationAttributes = [];

        const attrPromises = skuInfo.skuAttributes.map(async (attr) => {
            let attribute = attributes[attr.attributeId] ||
                await _model.Attribute.findOneAndUpdate(
                    { externalAttrId: attr.attributeId, name: attr.attributeNameTrans, vendor },
                    { externalAttrId: attr.attributeId, storeType: STORE_TYPE_ID, vendor, name: attr.attributeNameTrans, status: "active" },
                    { new: true, upsert: true }
                );

            attributes[attr.attributeId] = attribute;

            const term = await _model.AttributeTerm.findOneAndUpdate(
                { attribute: attribute._id, name: attr.valueTrans },
                { vendor, image: attr.skuImageUrl, attribute: attribute._id, name: attr.valueTrans, status: "active" },
                { new: true, upsert: true }
            );

            if (!variationAttributes[attribute._id]) {
                variationAttributes[attribute._id] = { _id: attribute._id, name: attr.attributeNameTrans, terms: [] };
            }

            if (!variationAttributes[attribute._id].terms.find(termItem => termItem._id.equals(term._id))) {
                variationAttributes[attribute._id].terms.push({ _id: term._id, name: attr.valueTrans, image: attr.skuImageUrl });
            }

            productVariationAttributes.push({ _id: term._id, name: attr.valueTrans });
        });

        await Promise.all(attrPromises);

        const productVariation = {
            specId: skuInfo.specId,
            skuId: skuInfo.skuId,
            description: skuInfo.description,
            image: skuInfo.image,
            sku: skuInfo.sku,
            price: skuInfo.consignPrice,
            compare_price: skuInfo.consignPrice,
            manage_stock: true,
            stock_quantity: skuInfo.amountOnSale,
            stock_status: skuInfo.amountOnSale ? "instock" : "outofstock",
            attributes: productVariationAttributes
        };

        const newProductVariation = await _model.productVariation.findOneAndUpdate(
            { skuId: skuInfo.skuId },
            productVariation,
            { new: true, upsert: true }
        );

        variationIds.push(newProductVariation._id);
    });

    await Promise.all(skuPromises);

    return {
        variations: variationIds,
        attributes: Object.values(variationAttributes)
    };
}

function transformPriceRange(priceRangeList) {
    if (_.isEmpty(priceRangeList)) return [];

    const sortedPriceRangeList = _.sortBy(priceRangeList, 'startQuantity');

    return _.map(sortedPriceRangeList, range => ({
        minQty: range.minQuantity ?? range.startQuantity,
        maxQty: range.maxQuantity,
        price: range.price,
        startQuantity: range.startQuantity ?? range.minQuantity,
    }));
}

module.exports = { updateProductDetails };
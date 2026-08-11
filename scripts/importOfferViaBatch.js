/* eslint-disable no-console */
/**
 * Import a 1688 offer via product-batch style save.
 * Usage: node scripts/importOfferViaBatch.js 562194449975
 */
require("../utils/globals");
require("../config/db");

const mongoose = require("mongoose");
const { getProductDetail } = require("../modules/products/services/alibaba");
const { updateProductDetails } = require("../modules/products/helper/migration");

const offerId = String(process.argv[2] || "").trim();
if (!/^\d{4,30}$/.test(offerId)) {
  console.error("Usage: node scripts/importOfferViaBatch.js <offerId>");
  process.exit(1);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForDbAndModels = async (timeoutMs = 45000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (mongoose.connection.readyState === 1 && global._model?.Product) return;
    await delay(250);
  }
  throw new Error("Timed out waiting for MongoDB/models initialization.");
};

(async () => {
  await waitForDbAndModels();

  const Product = global._model.Product;
  const existing = await Product.findOne({ offerId }).lean();
  console.log(
    existing
      ? `Existing product found: ${existing._id} status=${existing.status}`
      : "No existing catalog product for this offerId"
  );

  console.log(`Fetching 1688 detail for ${offerId}...`);
  const details = await getProductDetail(offerId);
  if (!details) {
    console.error("1688 returned no product detail");
    process.exit(1);
  }

  console.log(
    `1688 status=${details.status} name=${details.subjectTrans || details.subject || ""} skus=${Array.isArray(details.productSkuInfos) ? details.productSkuInfos.length : 0}`
  );

  const productDoc = existing
    ? await Product.findById(existing._id)
    : {
        offerId,
        vendor: "6625f5426b433d206e538ec2",
        meta_data: [],
      };

  const saved = await updateProductDetails(productDoc, details);
  if (!saved?._id) {
    console.error("updateProductDetails did not return a saved product");
    process.exit(1);
  }

  const ProductBatch = mongoose.connection.collection("productbatches");
  const batch = await ProductBatch.findOne(
    { "productIds.offerId": offerId },
    { sort: { createdAt: -1 } }
  );

  const lineStatus = existing ? "already exist" : "completed";
  const linePayload = {
    offerId,
    status: lineStatus,
    productDetails: {
      _id: saved._id,
      offerId,
      name: saved.name,
      status: saved.status,
    },
  };

  if (batch) {
    const productIds = (batch.productIds || []).map((row) =>
      String(row.offerId) === offerId ? { ...row, ...linePayload } : row
    );
    await ProductBatch.updateOne(
      { _id: batch._id },
      { $set: { productIds, status: "completed", updatedAt: new Date() } }
    );
    console.log(`Updated product batch ${batch._id}`);
  } else {
    const inserted = await ProductBatch.insertOne({
      title: `Offer ${offerId}`,
      status: "completed",
      productIds: [linePayload],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Created product batch ${inserted.insertedId}`);
  }

  console.log(
    JSON.stringify(
      {
        _id: String(saved._id),
        offerId: saved.offerId,
        name: saved.name,
        status: saved.status,
        type: saved.type,
        price: saved.price,
        variations: Array.isArray(saved.variations) ? saved.variations.length : 0,
      },
      null,
      2
    )
  );

  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

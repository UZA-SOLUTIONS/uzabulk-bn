const mongoose = require("mongoose");
const { bulkInsert } = require("../../../elasticsearch/indexes/productIndex");

const STORE_TYPE_ID = "660e3c271095513081ed2223";
const DEFAULT_VENDOR_ID = "6625f5426b433d206e538ec2";

const VARIATION_ATTR_RE = /^(color|colour|size|sizes|spec|规格|颜色|尺码|尺寸)$/i;

const normalizeAttrName = (attr = {}) =>
  String(attr.attributeNameTrans || attr.attributeName || "").trim();

const normalizeAttrValue = (attr = {}) =>
  String(attr.valueTrans || attr.value || "").trim();

const isVariationAttributeName = (name) => VARIATION_ATTR_RE.test(String(name || "").trim());

const groupVariationAttributes = (featureAttribute = []) => {
  const groups = new Map();

  for (const row of featureAttribute) {
    const name = normalizeAttrName(row);
    const value = normalizeAttrValue(row);
    if (!name || !value) continue;

    if (!groups.has(name)) {
      groups.set(name, { name, terms: [], attributeId: row.attributeId });
    }

    const group = groups.get(name);
    if (!group.terms.some((term) => term.name === value)) {
      group.terms.push({
        name: value,
        image: row.skuImageUrl || row.image || "",
        attributeId: row.attributeId,
      });
    }
  }

  return [...groups.values()].filter(
    (group) => group.terms.length > 1 && isVariationAttributeName(group.name)
  );
};

const cartesian = (lists) => {
  if (!lists.length) return [[]];
  return lists.reduce(
    (acc, list) => acc.flatMap((prefix) => list.map((item) => [...prefix, item])),
    [[]]
  );
};

const buildComboKey = (combo = []) =>
  combo.map((part) => `${part.attrName}=${part.term.name}`).join("|");

/**
 * When 1688 SKU sync is unavailable, rebuild selectable options from featureAttribute
 * (e.g. Color + Size rows already stored on the product).
 */
const syncVariationsFromFeatureAttribute = async (product = {}) => {
  const productId = product?._id;
  if (!productId) return false;

  const featureAttribute = Array.isArray(product.featureAttribute)
    ? product.featureAttribute
    : [];
  const variationGroups = groupVariationAttributes(featureAttribute);
  if (!variationGroups.length) return false;

  const vendor = product.vendor || DEFAULT_VENDOR_ID;
  const skuPrefix = `feature-${String(product.offerId || productId)}-`;
  await _model.productVariation.deleteMany({ skuId: { $regex: `^${skuPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` } });
  const basePrice = Number(product.price) || 0;
  const stockQty = Number(product.stock_quantity) || 0;
  const stockStatus = product.stock_status === "outofstock" ? "outofstock" : "instock";
  const manageStock = Boolean(product.manage_stock);

  const embeddedAttributes = [];
  const attributeTermMap = new Map();

  for (const group of variationGroups) {
    const attribute = await _model.Attribute.findOneAndUpdate(
      {
        externalAttrId: String(group.attributeId || group.name),
        name: group.name,
        vendor,
      },
      {
        externalAttrId: String(group.attributeId || group.name),
        storeType: STORE_TYPE_ID,
        vendor,
        name: group.name,
        status: "active",
      },
      { new: true, upsert: true }
    );

    const terms = [];
    for (const term of group.terms) {
      const savedTerm = await _model.AttributeTerm.findOneAndUpdate(
        { attribute: attribute._id, name: term.name },
        {
          vendor,
          image: term.image || "",
          attribute: attribute._id,
          name: term.name,
          status: "active",
        },
        { new: true, upsert: true }
      );
      terms.push({
        _id: savedTerm._id,
        name: savedTerm.name,
        image: savedTerm.image || "",
      });
      attributeTermMap.set(`${group.name}::${term.name}`, savedTerm._id);
    }

    embeddedAttributes.push({
      _id: attribute._id,
      name: group.name,
      terms,
    });
  }

  const comboParts = variationGroups.map((group) =>
    group.terms.map((term) => ({ attrName: group.name, term }))
  );
  const combinations = cartesian(comboParts);
  const variationIds = [];

  for (const combo of combinations) {
    const variationAttributes = combo.map((part) => ({
      _id: attributeTermMap.get(`${part.attrName}::${part.term.name}`),
      name: part.term.name,
    })).filter((attr) => attr._id);

    const comboKey = buildComboKey(combo);
    const skuId = `feature-${String(product.offerId || productId)}-${comboKey}`;

    const variationDoc = {
      specId: skuId,
      skuId,
      description: combo.map((part) => `${part.attrName}: ${part.term.name}`).join(" / "),
      image: combo.find((part) => part.term.image)?.term.image || "",
      sku: skuId,
      price: basePrice,
      compare_price: basePrice,
      manage_stock: manageStock,
      stock_quantity: stockQty,
      stock_status: stockStatus,
      attributes: variationAttributes,
      meta_data: [{ key: "source", value: "featureAttribute" }],
    };

    const savedVariation = await _model.productVariation.findOneAndUpdate(
      { skuId },
      variationDoc,
      { new: true, upsert: true }
    );
    variationIds.push(savedVariation._id);
  }

  const updatedProduct = await _model.Product.findOneAndUpdate(
    { _id: productId },
    {
      type: variationIds.length ? "variable" : "simple",
      attributes: embeddedAttributes,
      variations: variationIds,
      last_updated: new Date(),
    },
    { new: true }
  );

  if (updatedProduct) {
    await bulkInsert([updatedProduct]);
  }

  return variationIds.length > 0;
};

module.exports = {
  groupVariationAttributes,
  syncVariationsFromFeatureAttribute,
};

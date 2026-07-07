const mongoose = require("mongoose")
const constants = require('../config/constants.json')
let slug = require("mongoose-slug-updater")
let { transliterate } = require('transliteration');
mongoose.plugin(slug)
const variations = require("./productVariationTable");
let productSchema = new mongoose.Schema(
  {
    storeType: { type: mongoose.Schema.Types.ObjectId, ref: "storeType" },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true, trim: true },
    slug: { type: String, slug: "name", unique: true, lowercase: true, trim: true, transform: v => transliterate(v) },
    type: { type: String, enum: ["simple", "variable"] },
    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active"
    },
    isFeatured: { type: Boolean },
    short_description: { type: String, trim: true },
    description: { type: String, trim: true },
    sku: { type: String, trim: true },
    price: { type: Number, default: 0 },
    compare_price: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    topCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    secondCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    thirdCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: "Cuisine" },
    manage_stock: { type: Boolean, default: false },
    bestSeller: { type: Boolean, default: false },
    stock_quantity: { type: Number },
    serviceTime: { type: Number, default: 0 },
    serviceUnit: { type: String, enum: constants.serviceUnit_enum, default: "min" },
    pricingType: { type: String, enum: constants.pricingType_enum, default: "unit" },
    stock_status: {
      type: String,
      enum: ["instock", "outofstock"],
      default: "instock",
    },
    total_sales: { type: Number },
    featured_image: String,
    images: [{ type: String }],
    attributes: { type: Array },
    related_products: { type: Array, default: [] },
    variations: [
      { type: mongoose.Schema.Types.ObjectId, ref: "productVariation" },
    ],
    addons: [{ type: mongoose.Schema.Types.ObjectId, ref: "Addon" }],
    reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: "productReview" }],
    average_rating: { type: Number, default: 0 },
    rating_count: { type: Number, default: 0 },
    supplier_rating: { type: Number },
    supplier_rating_count: { type: Number, default: 0 },
    sold_count: { type: Number, default: 0 },
    shippingCharge: { type: Number },
    seoSettings: {
      title: { type: String, default: null },
      metaDescription: { type: String, default: null },
      metaKeywords: { type: String, default: null },
      facebook: {
        title: { type: String, default: null },
        description: { type: String, default: null },
        image: { type: String, default: null }
      },
      twitter: {
        title: { type: String, default: null },
        description: { type: String, default: null },
        image: { type: String, default: null },
        username: { type: String, default: null },
      }
    },
    date_created: { type: Date },
    date_created_utc: { type: Date, default: new Date() },
    date_modified: { type: Date },
    date_modified_utc: { type: Date },
    min_order_qty: { type: Number },
    price_tiers: [{
      startQuantity: Number,
      minQty: Number,
      maxQty: Number,
      price: Number
    }],
    meta_data: [
      {
        key: { type: String, trim: true },
        value: { type: String, trim: true },
      },
    ],
    weight: Number,
    adminSold: Boolean,
    offerId: String,
    sellerOpenId: { type: String, trim: true },
    seller_id: { type: String, trim: true },
    supplier_id: { type: String, trim: true },
    /** DashScope text-embedding-v3 vector for similar-product recommendations */
    embedding: { type: [Number], default: undefined },
    embedding_updated_at: { type: Date, default: null },
    elasticSearchIndexed: { type: Boolean, default: false },
    last_updated: { type: Date, default: null },
    deleted_at: { type: Date, default: null }
  },
  {
    versionKey: false,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

productSchema.index({ name: "text", status: 1, topCategoryId: 1, secondCategoryId: 1, thirdCategoryId: 1 }, { name: "name_text_search" });

productSchema.index({ status: 1, topCategoryId: 1, sold_count: -1 }, { name: "category_thumb_filter" });
productSchema.index({ status: 1, categories: 1, sold_count: -1 }, { name: "category_array_thumb_filter" });
productSchema.index({ categories: 1, status: 1, date_created_utc: -1 }, { name: "categories_status_date_filter" });
productSchema.index({ status: 1, average_rating: -1 }, { name: "top_ranking_filter" });

productSchema.index({ status: 1, price: 1, date_created_utc: -1 }, { name: "price_status_date_filter" });
productSchema.index({ status: 1, bestSeller: 1, categories: 1, date_created_utc: -1 }, { name: "best_seller_filter" });
productSchema.index({ status: 1, adminSold: 1, categories: 1, isFeatured: 1, date_created_utc: -1 }, { name: "admin_featured_filter" });
productSchema.index({ status: 1, elasticSearchIndexed: -1 }, { name: "elastic_search_indexing_filter" });
productSchema.index({ offerId: 1, status: 1 }, { name: "offer_status_lookup" });
productSchema.index({ supplier_id: 1, status: 1 }, { name: "supplier_status_lookup" });
productSchema.index({ sellerOpenId: 1, status: 1 }, { name: "seller_open_id_lookup" });


let Product = module.exports = mongoose.model("Product", productSchema);
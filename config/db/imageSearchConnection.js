'use strict';

const mongoose = require('mongoose');
const { getMongoClientOptions } = require('./index');

let connection = null;
let connectPromise = null;

const getMongoUri = () => process.env.MONGO_URI || process.env.MONGO_ATLAS_URI || '';

const isDedicatedImageSearchMongoEnabled = () => {
    const flag = String(process.env.IMAGE_SEARCH_DEDICATED_MONGO ?? 'true').toLowerCase();
    return flag !== '0' && flag !== 'false';
};

const getImageSearchConnection = async () => {
    if (!isDedicatedImageSearchMongoEnabled()) return null;

    const uri = getMongoUri();
    if (!uri) return null;

    if (connection?.readyState === 1) return connection;

    if (connectPromise) return connectPromise;

    const base = getMongoClientOptions();
    connectPromise = mongoose.createConnection(uri, {
        ...base,
        maxPoolSize: 3,
        minPoolSize: 1,
        socketTimeoutMS: 0,
        serverSelectionTimeoutMS: 30000,
    }).asPromise().then((conn) => {
        connection = conn;
        connectPromise = null;
        return conn;
    }).catch((err) => {
        connectPromise = null;
        console.warn('[image-search-mongo] dedicated connection failed:', err?.message || err);
        return null;
    });

    return connectPromise;
};

const getImageSearchProductModel = async () => {
    const conn = await getImageSearchConnection();
    if (!conn) return null;

    const Product = require('../../models/productsTable');
    if (conn.models.Product) return conn.models.Product;
    return conn.model('Product', Product.schema);
};

module.exports = {
    getImageSearchConnection,
    getImageSearchProductModel,
    isDedicatedImageSearchMongoEnabled,
};

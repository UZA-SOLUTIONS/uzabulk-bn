'use strict';
const mongoose = require("mongoose");
const logger = require('../logger');
const { setup } = require("../../models");

mongoose.set('bufferCommands', false);

let connectPromise = null;

const isMongoConnected = () => mongoose.connection.readyState === 1;

const connectDatabase = () => {
    if (isMongoConnected()) {
        return Promise.resolve(mongoose.connection);
    }

    if (connectPromise) {
        return connectPromise;
    }

    const mongoUri = process.env.MONGO_URI || process.env.MONGO_ATLAS_URI;

    if (!mongoUri) {
        const error = new Error('Mongo URI is missing. Set MONGO_URI in .env');
        logger.warn({ where: 'db connection', message: error.message });
        console.warn(error.message);
        return Promise.reject(error);
    }

    const safeUriLog = String(mongoUri).replace(/:([^:@/]+)@/, ":***@");
    console.log(`MongoDB connecting to ${safeUriLog}`);

    connectPromise = new Promise((resolve, reject) => {
        const db = mongoose.connection;

        const onOpen = () => {
            db.off('error', onError);
            logger.info({ where: 'db connection', message: 'Connected to MongoDB' });
            console.log('DB connected successfully');
            setup();
            resolve(db);
        };

        const onError = (err) => {
            db.off('open', onOpen);
            connectPromise = null;
            logger.error({
                where: 'db connection',
                message: `DB connection error: ${err.message}`,
            });
            console.error('DB connection error:', err.message);
            reject(err);
        };

        db.once('open', onOpen);
        db.once('error', onError);

        mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 20000,
        }).catch((err) => {
            db.off('open', onOpen);
            connectPromise = null;
            onError(err);
        });
    });

    return connectPromise;
};

connectDatabase().catch((err) => {
    console.error('Initial MongoDB connection failed:', err.message);
});

module.exports = {
    connectDatabase,
    isMongoConnected,
};

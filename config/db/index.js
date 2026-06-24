'use strict';
const mongoose = require("mongoose");
const logger = require('../logger');
const { setup } = require("../../models");

mongoose.set('bufferCommands', false);

let connectPromise = null;
let reconnectTimer = null;
let handlersAttached = false;

const isMongoConnected = () => mongoose.connection.readyState === 1;

const clamp = (value, min, max, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
};

const getMongoClientOptions = () => {
    const socketRaw = process.env.MONGO_SOCKET_TIMEOUT_MS;
    const options = {
        maxPoolSize: clamp(process.env.MONGO_MAX_POOL_SIZE, 5, 50, 20),
        minPoolSize: clamp(process.env.MONGO_MIN_POOL_SIZE, 0, 10, 2),
        serverSelectionTimeoutMS: clamp(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS, 3000, 30000, 10000),
        connectTimeoutMS: clamp(process.env.MONGO_CONNECT_TIMEOUT_MS, 3000, 30000, 10000),
        socketTimeoutMS: socketRaw !== undefined && socketRaw !== ""
            ? clamp(socketRaw, 0, 300000, 120000)
            : 0,
        heartbeatFrequencyMS: clamp(process.env.MONGO_HEARTBEAT_FREQUENCY_MS, 5000, 30000, 10000),
        maxIdleTimeMS: clamp(process.env.MONGO_MAX_IDLE_TIME_MS, 30000, 300000, 60000),
    };

    const waitQueue = process.env.MONGO_WAIT_QUEUE_TIMEOUT_MS;
    if (waitQueue !== undefined && waitQueue !== "" && waitQueue !== "0") {
        options.waitQueueTimeoutMS = clamp(waitQueue, 5000, 120000, 30000);
    }

    return options;
};

const scheduleReconnect = () => {
    if (reconnectTimer || isMongoConnected()) return;

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (isMongoConnected()) return;

        connectPromise = null;
        console.warn('MongoDB disconnected — attempting reconnect...');
        connectDatabase().catch((err) => {
            console.error('MongoDB reconnect failed:', err.message);
            scheduleReconnect();
        });
    }, clamp(process.env.MONGO_RECONNECT_DELAY_MS, 1000, 60000, 3000));
};

const attachConnectionHandlers = (db) => {
    if (handlersAttached) return;
    handlersAttached = true;

    db.on('disconnected', () => {
        connectPromise = null;
        logger.warn({ where: 'db connection', message: 'MongoDB disconnected' });
        console.warn('MongoDB disconnected');
        scheduleReconnect();
    });

    db.on('reconnected', () => {
        logger.info({ where: 'db connection', message: 'MongoDB reconnected' });
        console.log('MongoDB reconnected');
    });

    db.on('error', (err) => {
        logger.error({
            where: 'db connection',
            message: `MongoDB connection error: ${err.message}`,
        });
    });
};

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

    const db = mongoose.connection;
    attachConnectionHandlers(db);

    connectPromise = new Promise((resolve, reject) => {
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
            scheduleReconnect();
            reject(err);
        };

        db.once('open', onOpen);
        db.once('error', onError);

        mongoose.connect(mongoUri, getMongoClientOptions()).catch((err) => {
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
    getMongoClientOptions,
};

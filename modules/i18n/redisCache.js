const { createClient } = require("redis");

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

let client = null;

const getClient = async () => {
    if (client) return client;
    client = createClient({ url: "redis://127.0.0.1:6379" });
    client.on("error", (err) => console.warn("[redis]", err.message));
    await client.connect();
    return client;
};

const redisGet = async (key) => {
    try {
        const c = await getClient();
        return await c.get(key);
    } catch {
        return null;
    }
};

const redisSet = async (key, value) => {
    try {
        const c = await getClient();
        await c.set(key, value, { EX: TTL_SECONDS });
    } catch {
        /* ignore */
    }
};

const redisMGet = async (keys) => {
    try {
        const c = await getClient();
        return await c.mGet(keys);
    } catch {
        return keys.map(() => null);
    }
};

const redisMSet = async (pairs) => {
    try {
        const c = await getClient();
        const pipeline = c.multi();
        pairs.forEach(([key, value]) => pipeline.set(key, value, { EX: TTL_SECONDS }));
        await pipeline.exec();
    } catch {
        /* ignore */
    }
};

module.exports = { redisGet, redisSet, redisMGet, redisMSet };

/**
 * Run async mapper over items with a fixed concurrency limit.
 */
const mapPool = async (items = [], concurrency = 4, mapper = async () => undefined) => {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return [];

    const cap = Math.max(1, Math.min(Number(concurrency) || 4, list.length));
    const results = new Array(list.length);
    let cursor = 0;

    const workers = Array.from({ length: cap }, async () => {
        while (cursor < list.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await mapper(list[index], index);
        }
    });

    await Promise.all(workers);
    return results;
};

module.exports = { mapPool };

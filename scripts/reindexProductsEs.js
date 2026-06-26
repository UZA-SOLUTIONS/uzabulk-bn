/* eslint-disable no-console */
require("../utils/globals");

const esHelper = require("../elasticsearch/esHelper");
const productIndex = require("../elasticsearch/indexes/productIndex");
const { refreshElasticsearchAvailability } = require("../elasticsearch/availability");
const {
    INDEX_ALIAS,
    delay,
    readState,
    writeState,
    inferLastIdFromEsCount,
    withMongoRetry,
    fetchActiveBatch,
    indexBatch,
    countMongoActive,
    runIncrementalSync,
} = require("../elasticsearch/productReindexShared");

const INDEX_PREFIX = "products_v2";
const PUBLISH_PARTIAL = process.env.ES_REINDEX_PUBLISH_PARTIAL !== "false";
const PUBLISH_EVERY_BATCHES = Math.max(
    1,
    Number(process.env.ES_REINDEX_PUBLISH_EVERY_BATCHES) || 10
);

let activeTargetIndex = "";

const parseArgs = () => {
    const args = process.argv.slice(2);
    const getFlagValue = (...prefixes) => {
        for (const prefix of prefixes) {
            const match = args.find((arg) => arg.startsWith(`${prefix}=`));
            if (match) return match.slice(prefix.length + 1).trim();
        }
        return "";
    };
    const flags = new Set(args.filter((arg) => arg.startsWith("-")));
    const positionals = args.filter((arg) => !arg.startsWith("-"));
    const indexFromEnv = String(process.env.ES_REINDEX_INDEX || process.env.ES_REINDEX_TARGET || "").trim();
    const index =
        getFlagValue("--target", "--index")
        || indexFromEnv
        || positionals[0]
        || "";

    return {
        help: flags.has("--help") || flags.has("-h"),
        resume: flags.has("--resume"),
        sync: flags.has("--sync"),
        fresh: flags.has("--fresh"),
        noPublishPartial: flags.has("--no-publish-partial"),
        index,
    };
};

const printHelp = () => {
    console.log(`
Product Elasticsearch reindex

  npm run es:reindex:products
      Full rebuild into a new versioned index (checkpointed).

  npm run es:reindex:products:resume
      Continue an interrupted full reindex (auto-uses alias/checkpoint).

  npm run es:reindex:products:sync
      Upsert new/changed active products into the current alias index.

Options:
  --fresh              Ignore saved checkpoint and start a new full index.
  --no-publish-partial Wait until 100% done before switching search alias.
  --target=<name>      Target index (npm-safe; prefer over --index).
  ES_REINDEX_INDEX     Same as --target (for npm on Windows).
  ES_REINDEX_PUBLISH_PARTIAL=false   Never publish partial progress to search.
  ES_REINDEX_PUBLISH_EVERY_BATCHES=10   Update search alias every N batches (if larger).

Partial publish (default on):
  Each batch is saved in Elasticsearch immediately. When a batch finishes, errors
  occur, or you Ctrl+C, search switches to the in-progress index if it has MORE
  products than the current live alias — so progress is searchable before 100%.

Checkpoint file: scripts/.reindex-products-state.json

Background sync:
  Runs automatically after the 1688 catalog job updates products.
  Optional: ES_PRODUCT_SYNC_INTERVAL_HOURS>0 for periodic catch-up.
`);
};

const buildIndexName = () =>
    `${INDEX_PREFIX}_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}_${Date.now()}`;

const resolveResumeCursor = async (targetIndex, state) => {
    if (state?.lastId) {
        console.log(`Resuming from checkpoint _id > ${state.lastId}`);
        return {
            targetIndex,
            lastId: state.lastId,
            indexed: Number(state.indexed) || 0,
        };
    }

    const inferred = await inferLastIdFromEsCount(targetIndex);
    if (inferred.lastId) {
        return { targetIndex, ...inferred };
    }

    console.log(`Starting index '${targetIndex}' from the beginning.`);
    return { targetIndex, lastId: null, indexed: 0 };
};

const shouldPublishPartial = (noPublishPartial) =>
    PUBLISH_PARTIAL && !noPublishPartial;

/** Point search alias at in-progress index when it has more docs than live search. */
const publishProgressIfBetter = async (targetIndex, { reason = "" } = {}) => {
    if (!targetIndex) return { published: false };

    const aliasIndex = await esHelper.getAliasTargetIndex(INDEX_ALIAS);
    const aliasCount = aliasIndex ? await esHelper.countDocuments(INDEX_ALIAS) : 0;
    const targetCount = await esHelper.countDocuments(targetIndex);

    if (targetIndex === aliasIndex) {
        return { published: false, aliasCount, targetCount, aliasIndex };
    }
    if (targetCount <= aliasCount) {
        return { published: false, aliasCount, targetCount, aliasIndex };
    }

    await esHelper.pointAliasToIndex(INDEX_ALIAS, targetIndex);
    await refreshElasticsearchAvailability();
    const tag = reason ? ` (${reason})` : "";
    console.log(
        `Search now uses '${targetIndex}' — ${targetCount} products (was ${aliasCount} on '${aliasIndex || "none"}')${tag}`
    );
    writeState({
        aliasPublishedAt: new Date().toISOString(),
        aliasPublishedCount: targetCount,
    });
    return { published: true, aliasCount, targetCount, aliasIndex };
};

const runFullReindex = async ({ resume, fresh, indexName, noPublishPartial }) => {
    const prior = readState();
    let targetIndex = indexName;
    let lastId = null;
    let indexed = 0;
    let batch = 0;

    if (resume && !fresh) {
        targetIndex =
            indexName
            || prior?.targetIndex
            || (await esHelper.getAliasTargetIndex(INDEX_ALIAS));
        if (!targetIndex) {
            throw new Error(
                "Resume needs a target index (alias, --target=..., ES_REINDEX_INDEX, or checkpoint)."
            );
        }
        if (!(await esHelper.indexExists(targetIndex))) {
            throw new Error(`Index '${targetIndex}' does not exist.`);
        }

        const aliasIndex = await esHelper.getAliasTargetIndex(INDEX_ALIAS);
        const aliasCount = aliasIndex ? await esHelper.countDocuments(INDEX_ALIAS) : 0;
        const targetCount = await esHelper.countDocuments(targetIndex);
        console.log(`Live search alias '${INDEX_ALIAS}' -> ${aliasIndex || "(none)"} (${aliasCount} docs)`);
        console.log(`Resume target index: '${targetIndex}' (${targetCount} docs in ES)`);
        if (aliasIndex && aliasIndex !== targetIndex) {
            console.log(
                "In-progress index differs from live alias — partial publish will switch search when this index is larger."
            );
        }

        ({ lastId, indexed } = await resolveResumeCursor(targetIndex, prior));
        console.log(`Resume full reindex on '${targetIndex}' (${indexed} already indexed).`);
        writeState({
            mode: "full",
            targetIndex,
            lastId,
            indexed,
            completed: false,
        });
        activeTargetIndex = targetIndex;
        if (shouldPublishPartial(noPublishPartial)) {
            await publishProgressIfBetter(targetIndex, { reason: "resume-start" });
        }
    } else {
        targetIndex = buildIndexName();
        console.log(`Creating target index '${targetIndex}'...`);
        await esHelper.createIndex(targetIndex, productIndex.indexMapping);
        writeState({
            mode: "full",
            targetIndex,
            lastId: null,
            indexed: 0,
            completed: false,
            startedAt: new Date().toISOString(),
        });
    }

    activeTargetIndex = targetIndex;

    while (true) {
        const docs = await withMongoRetry("Mongo batch fetch", () => fetchActiveBatch(lastId));
        if (!docs.length) break;

        await indexBatch(docs, targetIndex);
        batch += 1;
        indexed += docs.length;
        lastId = String(docs[docs.length - 1]._id);

        writeState({
            mode: "full",
            targetIndex,
            lastId,
            indexed,
            completed: false,
        });

        console.log(`Indexed batch ${batch} (${docs.length} docs, ${indexed} total)`);

        if (
            shouldPublishPartial(noPublishPartial)
            && (batch % PUBLISH_EVERY_BATCHES === 0)
        ) {
            await publishProgressIfBetter(targetIndex, { reason: `batch-${batch}` });
        }
    }

    const mongoTotal = await withMongoRetry("Mongo count", countMongoActive);
    const esTotal = await esHelper.countDocuments(targetIndex);
    console.log(`Mongo active: ${mongoTotal} | ES index '${targetIndex}': ${esTotal}`);

    if (esTotal < mongoTotal) {
        throw new Error(
            `Index incomplete (${esTotal}/${mongoTotal}). Fix Mongo/ES connectivity and run: npm run es:reindex:products:resume`
        );
    }

    await esHelper.pointAliasToIndex(INDEX_ALIAS, targetIndex);
    console.log(`Alias '${INDEX_ALIAS}' -> '${targetIndex}' (${esTotal} products)`);
    await refreshElasticsearchAvailability();

    writeState({
        mode: "full",
        targetIndex,
        lastId,
        indexed: esTotal,
        completed: true,
        completedAt: new Date().toISOString(),
        lastSyncedId: lastId,
        lastSyncAt: new Date().toISOString(),
    });

    console.log("Full reindex complete.");
};

const run = async () => {
    const args = parseArgs();
    if (args.help) {
        printHelp();
        return;
    }

    process.once("SIGINT", () => {
        console.warn("\nInterrupted — saving progress and publishing partial index if possible...");
        publishProgressIfBetter(activeTargetIndex, { reason: "interrupt" })
            .catch(() => {})
            .finally(() => process.exit(130));
    });

    if (args.sync) {
        await runIncrementalSync({ indexName: args.index || "" });
        return;
    }

    await runFullReindex({
        resume: args.resume,
        fresh: args.fresh,
        indexName: args.index || "",
        noPublishPartial: args.noPublishPartial,
    });
};

run()
    .catch(async (error) => {
        console.error("reindexProductsEs failed:", error.message);
        const state = readState();
        if (state?.targetIndex && !state.completed) {
            if (shouldPublishPartial(false)) {
                try {
                    await publishProgressIfBetter(state.targetIndex, { reason: "error" });
                } catch (publishError) {
                    console.warn("Partial publish on error failed:", publishError.message);
                }
            }
            console.error(
                `Checkpoint saved. Resume with: npm run es:reindex:products:resume`
            );
            if (state.targetIndex) {
                console.error(`  (index: ${state.targetIndex}, indexed: ${state.indexed || 0})`);
            }
        }
        process.exitCode = 1;
    })
    .finally(() => {
        setTimeout(() => process.exit(), 100);
    });

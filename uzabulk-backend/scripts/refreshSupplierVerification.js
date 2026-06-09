/* eslint-disable no-console */
/**
 * Manual / cron: refresh stale 1688 supplier verifications.
 *   node scripts/refreshSupplierVerification.js
 *   node scripts/refreshSupplierVerification.js --limit=100 --force-member=b2b-xxx
 */
require("../utils/globals");
const { connectDatabase } = require("../config/db");
const {
    verifySupplier,
    refreshStaleSuppliers,
    verifySuppliersFromCatalog,
} = require("../modules/products/services/supplierVerificationService");

const parseArgs = () => {
    const args = { limit: 50, member: "" };
    for (const arg of process.argv.slice(2)) {
        if (arg.startsWith("--limit=")) {
            args.limit = Number(arg.split("=")[1]) || 50;
        } else if (arg.startsWith("--force-member=")) {
            args.member = arg.split("=")[1] || "";
        } else if (arg === "--catalog") {
            args.catalog = true;
        }
    }
    return args;
};

const run = async () => {
    const args = parseArgs();
    await connectDatabase();

    if (args.member) {
        const row = await verifySupplier({
            memberId: args.member,
            force: true,
        });
        console.log(JSON.stringify(row, null, 2));
        process.exit(0);
        return;
    }

    if (args.catalog) {
        const catalog = await verifySuppliersFromCatalog({ limit: args.limit });
        console.log("Catalog verification:", catalog);
        process.exit(0);
        return;
    }

    const result = await refreshStaleSuppliers({ limit: args.limit });
    console.log("Refresh result:", result);
    process.exit(0);
};

run().catch((error) => {
    console.error(error);
    process.exit(1);
});

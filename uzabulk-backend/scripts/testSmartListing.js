/* eslint-disable no-console */
/**
 * End-to-end Smart Listing smoke test (no HTTP server needed).
 *   npm run smart-listing:test
 *   npm run smart-listing:test -- "https://your-image-url.jpg" 45.5
 */
require("../utils/globals");
const { runSmartListing, isDashscopeConfigured } = require("../modules/ai/services/smartListingService");

// Must be a public HTTPS URL DashScope can download (S3/CDN OK; some 1688 URLs fail).
const SAMPLE_IMAGE =
    "https://uza-ecomm.s3.us-east-2.amazonaws.com/1760592554425download%20%289%29.jpeg";

const run = async () => {
    if (!isDashscopeConfigured()) {
        console.error("Set DASHSCOPE_API_KEY in .env first.");
        process.exit(1);
    }

    const imageUrl = process.argv[2] || SAMPLE_IMAGE;
    const sourcePriceCNY = process.argv[3] ? Number(process.argv[3]) : 35;

    console.log("Smart Listing test");
    console.log("  image:", imageUrl);
    console.log("  source price CNY:", sourcePriceCNY);
    console.log("");

    const result = await runSmartListing({ imageUrl, sourcePriceCNY });

    console.log("--- Step 1: Vision attributes (qwen-vl-plus) ---");
    console.log(JSON.stringify(result.attributes, null, 2));

    console.log("\n--- Step 2: Generated listing ---");
    console.log("  text model used:", result.listing._model_used || result.models.text);
    delete result.listing._model_used;
    console.log(JSON.stringify(result.listing, null, 2));

    console.log("\n--- Models configured ---");
    console.log(result.models);
    console.log("\n✅ Smart listing pipeline OK");
};

run().catch((error) => {
    console.error("Smart listing failed:", error?.error || error?.message || error);
    process.exit(1);
});

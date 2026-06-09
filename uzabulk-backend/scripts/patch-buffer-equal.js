const fs = require("fs");
const path = require("path");

const targetFile = path.resolve(
  __dirname,
  "..",
  "node_modules",
  "buffer-equal-constant-time",
  "index.js"
);

if (!fs.existsSync(targetFile)) {
  process.exit(0);
}

const original = fs.readFileSync(targetFile, "utf8");

// Patch for Node runtimes where SlowBuffer is undefined.
const patched = original
  .replace(
    "Buffer.prototype.equal = SlowBuffer.prototype.equal = function equal(that) {",
    "Buffer.prototype.equal = function equal(that) {"
  )
  .replace(
    "var origSlowBufEqual = SlowBuffer.prototype.equal;",
    "var origSlowBufEqual = SlowBuffer && SlowBuffer.prototype ? SlowBuffer.prototype.equal : undefined;"
  )
  .replace(
    "  SlowBuffer.prototype.equal = origSlowBufEqual;",
    "  if (SlowBuffer && SlowBuffer.prototype) { SlowBuffer.prototype.equal = origSlowBufEqual; }"
  );

if (patched !== original) {
  fs.writeFileSync(targetFile, patched, "utf8");
  // eslint-disable-next-line no-console
  console.log("Patched buffer-equal-constant-time for SlowBuffer compatibility.");
}

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { guessLocalImagePath } = require("../../ai/helpers/resolveVisionImageInput");
const { uploadProductImage } = require("../services/alibaba");

const execFileAsync = promisify(execFile);

const readImageBase64 = (localPath) => fs.readFileSync(localPath).toString("base64");

const isPublicHttpUrl = (url) =>
    /^https?:\/\//i.test(url) && !/localhost|127\.0\.0\.1/i.test(url);

const extractO1cnImageName = (value = "") => {
    const raw = String(value || "");
    const match = raw.match(/(O1CN[\w!.-]+?\.(?:jpe?g|png|webp|gif))/i);
    return match ? match[1] : "";
};

const buildAlicdnImageAddress = (value = "") => {
    const imageName = extractO1cnImageName(value);
    if (!imageName) return "";
    return `https://cbu01.alicdn.com/img/ibank/${imageName}`;
};

const compressImageBase64 = async (localPath) => {
    const original = readImageBase64(localPath);
    if (original.length <= 90_000) {
        return original;
    }

    const pythonBin = process.env.LOCAL_IMAGE_SEARCH_PYTHON_BIN || "python";
    const script = [
        "import base64, io, sys",
        "from PIL import Image",
        "path = sys.argv[1]",
        "img = Image.open(path).convert('RGB')",
        "img.thumbnail((960, 960))",
        "buf = io.BytesIO()",
        "img.save(buf, format='JPEG', quality=78, optimize=True)",
        "print(base64.b64encode(buf.getvalue()).decode())",
    ].join("\n");

    try {
        const { stdout } = await execFileAsync(pythonBin, ["-c", script, localPath], {
            timeout: 30_000,
            maxBuffer: 2 * 1024 * 1024,
        });
        const compressed = String(stdout || "").trim();
        return compressed || original;
    } catch (_) {
        return original;
    }
};

/**
 * Prepare 1688 image-search input from a local upload URL or public image URL.
 */
const resolveAlibabaImageSearchInput = async (imageAddress) => {
    const url = String(imageAddress || "").trim();
    if (!url) return null;

    if (/alicdn\.com/i.test(url)) {
        return { imageAddress: url };
    }

    const alicdnFromUrl = buildAlicdnImageAddress(url);
    if (alicdnFromUrl) {
        return { imageAddress: alicdnFromUrl };
    }

    const localPath = guessLocalImagePath(url);
    if (localPath) {
        const alicdnFromFile = buildAlicdnImageAddress(path.basename(localPath));
        if (alicdnFromFile) {
            return { imageAddress: alicdnFromFile };
        }

        const imageBase64 = await compressImageBase64(localPath);
        const imageId = await uploadProductImage({ imageBase64 });
        if (imageId && String(imageId) !== "0") {
            return { imageId: String(imageId) };
        }

        if (imageBase64.length <= 120_000) {
            return { imageBase64 };
        }

        return null;
    }

    if (isPublicHttpUrl(url)) {
        return { imageAddress: url };
    }

    return null;
};

module.exports = {
    resolveAlibabaImageSearchInput,
    buildAlicdnImageAddress,
    extractO1cnImageName,
};

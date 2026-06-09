
//Here  declaraning global variable;

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const rootEnvPath = path.resolve(__dirname, "../.env");
const productionEnvPath = path.resolve(__dirname, "../.env.production");

// Always load backend .env regardless of process cwd.
const rootEnv = dotenv.config({ path: rootEnvPath }).parsed || {};
// In production, merge .env.production but keep MONGO_URI from .env when set
// (avoids local dev breaking when NODE_ENV=production and .env.production points at 127.0.0.1).
if (process.env.NODE_ENV === "production" && fs.existsSync(productionEnvPath)) {
    const productionEnv = dotenv.parse(fs.readFileSync(productionEnvPath));
    for (const [key, value] of Object.entries(productionEnv)) {
        if (key === "MONGO_URI" && rootEnv.MONGO_URI) continue;
        if (key === "MONGO_ATLAS_URI" && rootEnv.MONGO_ATLAS_URI) continue;
        process.env[key] = value;
    }
}

global.logger = require("../config/logger");
global._model = global._model || {};

// Set environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '../config/env' : '../config/env-stagging';
global.env = require(envFile)

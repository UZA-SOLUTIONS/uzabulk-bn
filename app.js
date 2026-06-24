// Global declarations
require("./utils/globals");
const i18n = require('./i18n');

const db = require("./config/db");

const mongoSanitize = require("express-mongo-sanitize");
const express = require('express');
const helmet = require('helmet');
const { xss } = require('express-xss-sanitizer');
const compression = require('compression');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const app = express();
const commonRes = require("./utils/response")
// Public product/upload images are embedded on the storefront (often another origin in dev).
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// Sanitize requests
app.use(mongoSanitize());

// parse json request body
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: '150mb' }));
// sanitize request data
app.use(xss());

// gzip compression
app.use(compression());

// enable cors
app.use(cors({ origin: "*" }));

// Uploaded product images must be embeddable on the storefront (different port/origin in dev).
app.use("/images", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

// Use Morgan for request logging
app.use(morgan('dev'));
app.use(i18n);

app.use((req, res, next) => {
    res = commonRes(req, res);
    next();
});

app.use(express.static("public"));

app.get("/search", (req, res) => {
    res.redirect("/search/index.html");
});

// Load your routes

require('./routes')(app);

module.exports = app;

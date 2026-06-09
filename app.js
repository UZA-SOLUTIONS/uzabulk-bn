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
// set security HTTP headers
app.use(helmet());

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

// Use Morgan for request logging
app.use(morgan('dev'));
app.use(i18n);

app.use((req, res, next) => {
    res = commonRes(req, res);
    next();
});

app.use(express.static("public"));


// Load your routes

require('./routes')(app);

module.exports = app;

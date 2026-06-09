const express = require("express");
const router = express.Router();
const controller = require("./controllers");
const upload = require("../../lib/awsimage-upload");
router.post("/add", upload.uploadLocalFile, controller.addFileData);

module.exports = router;

const express = require("express");
const router = express.Router();
const validator = require("./validators/address");
const controller = require("./controllers/address");
const authMiddleware = require("../../middleware/authentication");
const { setPagination } = require("../../middleware");

router.post("/add", authMiddleware, validator.add, controller.add);
router.put("/update/:_id", authMiddleware, validator.update, controller.update);
router.put("/makeDefaultAddress/:_id", authMiddleware, validator.makeDefaultAddress, controller.makeDefaultAddress);
router.get("/view/:_id", authMiddleware, validator.view, controller.view);
router.delete("/delete/:_id", authMiddleware, validator.delete, controller.delete);
router.get("/list", authMiddleware, setPagination, controller.list);

module.exports = router;

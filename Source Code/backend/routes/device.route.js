const express = require("express");
const router = express.Router();

const controller = require("../controllers/device.controller");
const verifyToken = require("../middleware/verifyToken");

// ✅ Bước 1: Admin tạo device (từ app)
router.post("/register", verifyToken, controller.registerDevice);

router.get("/ca-certificate", controller.getCACertificate);

module.exports = router;

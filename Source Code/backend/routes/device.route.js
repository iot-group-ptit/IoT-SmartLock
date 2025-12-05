const express = require("express");
const router = express.Router();

const controller = require("../controllers/device.controller");
const verifyToken = require("../middleware/verifyToken");

// ✅ Bước 1: Admin tạo device (từ app)
router.post("/register", verifyToken, controller.registerDevice);

// // ✅ THÊM: Kiểm tra trạng thái device
// router.get("/status/:device_id", verifyToken, controller.getDeviceStatus);

// // ✅ THÊM: Lấy danh sách tất cả devices (cho admin)
// router.get("/list", controller.listDevices);

// // ✅ THÊM: Xóa device (revoke certificate)
// router.delete("/:device_id", controller.deleteDevice);

module.exports = router;

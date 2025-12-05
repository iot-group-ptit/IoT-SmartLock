const express = require("express");
const router = express.Router();
const controller = require("../controllers/notification.controller");
const verifyToken = require("../middleware/verifyToken");
const checkRole = require("../middleware/checkRole");

// Lấy tất cả notification của user_manager
router.get("/", verifyToken, controller.getAllNotifications);

// Đánh dấu đã đọc một notification
router.patch("/:notificationId/read", verifyToken, controller.markAsRead);

// Xóa một notification
router.delete("/:notificationId", verifyToken, controller.deleteNotification);

// Lấy thống kê cảnh báo
router.get(
  "/statistics",
  verifyToken,
  checkRole("user_manager"),
  controller.getAlertStatistics
);

module.exports = router;

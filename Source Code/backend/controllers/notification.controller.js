const Notification = require("../models/notification.model");
const Device = require("../models/device.model");
const AccessLog = require("../models/log.model");

//[GET] http://localhost:3000/notifications - Lấy tất cả notification của user_manager
module.exports.getAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, type, isRead } = req.query;

    // Build query
    const query = { user_id: userId };

    if (type) {
      query.notification_type = type;
    }

    if (isRead !== undefined) {
      query.is_read = isRead === "true";
    }

    // Đếm tổng số
    const total = await Notification.countDocuments(query);

    // Lấy toàn bộ notifications
    const notifications = await Notification.find(query)
      .sort({ created_at: -1 }) // mới nhất lên trước
      .lean();

    // Đếm số lượng chưa đọc
    const unreadCount = await Notification.countDocuments({
      user_id: userId,
      is_read: false,
    });

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi lấy danh sách thông báo",
    });
  }
};

//[PATCH] http://localhost:3000/notification/:notificationId/read - Đánh dấu một notification đã đọc
module.exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    const notification = await Notification.findOne({
      _id: notificationId,
      user_id: userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông báo",
      });
    }

    notification.is_read = true;
    await notification.save();

    return res.status(200).json({
      success: true,
      message: "Đã đánh dấu đã đọc",
      data: notification,
    });
  } catch (error) {
    console.error("Lỗi đánh dấu đã đọc:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi đánh dấu thông báo",
    });
  }
};

// [DELETE] http://localhost:3000/notification/:notificationId - Xóa một notification
module.exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      user_id: userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông báo",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Đã xóa thông báo",
    });
  } catch (error) {
    console.error("Lỗi xóa notification:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi xóa thông báo",
    });
  }
};

// [GET] http://localhost:3000/notification/statistics - Lấy thống kê cảnh báo bảo mật
module.exports.getAlertStatistics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 7 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Tổng số cảnh báo
    const totalAlerts = await Notification.countDocuments({
      user_id: userId,
      notification_type: "security_alert",
      created_at: { $gte: startDate },
    });

    // Cảnh báo chưa đọc
    const unreadAlerts = await Notification.countDocuments({
      user_id: userId,
      notification_type: "security_alert",
      is_read: false,
      created_at: { $gte: startDate },
    });

    // Thống kê theo thiết bị
    const alertsByDevice = await Notification.aggregate([
      {
        $match: {
          user_id: userId,
          notification_type: "security_alert",
          created_at: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: "$metadata.deviceId",
          count: { $sum: 1 },
          deviceName: { $first: "$metadata.deviceName" },
          lastAlert: { $max: "$created_at" },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // Thống kê theo ngày
    const alertsByDay = await Notification.aggregate([
      {
        $match: {
          user_id: userId,
          notification_type: "security_alert",
          created_at: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$created_at" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Thiết bị có nhiều cảnh báo nhất
    const topAlertDevice = alertsByDevice[0] || null;

    return res.status(200).json({
      success: true,
      data: {
        period: `${days} ngày qua`,
        summary: {
          totalAlerts,
          unreadAlerts,
          readRate:
            totalAlerts > 0
              ? (((totalAlerts - unreadAlerts) / totalAlerts) * 100).toFixed(
                  1
                ) + "%"
              : "0%",
        },
        byDevice: alertsByDevice,
        byDay: alertsByDay,
        topAlertDevice,
      },
    });
  } catch (error) {
    console.error("Lỗi lấy statistics:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi lấy thống kê",
    });
  }
};

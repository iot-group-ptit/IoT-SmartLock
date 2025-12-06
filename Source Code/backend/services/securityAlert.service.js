const AccessLog = require("../models/log.model");
const Device = require("../models/device.model");
const User = require("../models/user.model");
const Notification = require("../models/notification.model");

class SecurityAlertService {
  constructor() {
    this.FAILED_ATTEMPTS_THRESHOLD = 3; // Số lần thất bại tối đa
    this.TIME_WINDOW_MINUTES = 3; // Khoảng thời gian kiểm tra (phút)
    this.deviceAlertCache = new Map(); // Cache để tránh spam cảnh báo
  }

  /**
   * Kiểm tra số lần mở khóa thất bại và gửi cảnh báo nếu cần
   * @param {String} deviceId - ID của thiết bị
   * @param {String} accessMethod - Phương thức truy cập (rfid, fingerprint, face)
   */
  async checkFailedAttempts(deviceId, accessMethod) {
    try {
      if (!deviceId) {
        console.log("⚠️ Không có deviceId để kiểm tra");
        return;
      }

      // Lấy thời điểm hiện tại và thời điểm 3 phút trước
      const now = new Date();
      const timeWindowStart = new Date(
        now.getTime() - this.TIME_WINDOW_MINUTES * 60 * 1000
      );

      // Đếm số lần thất bại trong khoảng thời gian
      const failedAttempts = await AccessLog.countDocuments({
        device_id: deviceId,
        result: "failed",
        createdAt: { $gte: timeWindowStart, $lte: now },
        access_method: { $in: ["rfid", "fingerprint", "face"] }, // Chỉ đếm các phương thức xác thực thực tế
      });

      console.log(
        `🔍 Device ${deviceId}: ${failedAttempts} lần thất bại trong ${this.TIME_WINDOW_MINUTES} phút qua`
      );

      // Nếu đạt ngưỡng cảnh báo
      if (failedAttempts >= this.FAILED_ATTEMPTS_THRESHOLD) {
        // Kiểm tra xem đã gửi cảnh báo gần đây chưa (tránh spam)
        const lastAlertTime = this.deviceAlertCache.get(deviceId);
        const shouldSendAlert =
          !lastAlertTime ||
          now.getTime() - lastAlertTime.getTime() > 5 * 60 * 1000; // 5 phút giữa các cảnh báo

        if (shouldSendAlert) {
          await this.sendSecurityAlert(
            deviceId,
            failedAttempts,
            timeWindowStart,
            now
          );
          this.deviceAlertCache.set(deviceId, now);
        } else {
          console.log(
            `⏭️ Bỏ qua cảnh báo (đã gửi gần đây cho device ${deviceId})`
          );
        }
      }
    } catch (error) {
      console.error("❌ Lỗi kiểm tra failed attempts:", error);
    }
  }

  /**
   * Gửi cảnh báo bảo mật đến user_manager và LƯU VÀO DATABASE
   * @param {String} deviceId - ID thiết bị
   * @param {Number} failedCount - Số lần thất bại
   * @param {Date} startTime - Thời điểm bắt đầu
   * @param {Date} endTime - Thời điểm kết thúc
   */
  async sendSecurityAlert(deviceId, failedCount, startTime, endTime) {
    try {
      console.log(
        `🚨 CẢNH BÁO BẢO MẬT: Device ${deviceId} có ${failedCount} lần mở khóa thất bại!`
      );

      // 1. Lấy thông tin thiết bị
      const device = await Device.findOne({ device_id: deviceId });

      if (!device) {
        console.log("⚠️ Không tìm thấy thiết bị");
        return;
      }

      // 2. Tìm user_manager quản lý thiết bị này (qua org_id)
      const manager = await User.findById(device.user_id).select(
        "_id fullName email"
      );

      if (!manager) {
        console.log("⚠️ Không tìm thấy user_manager để gửi cảnh báo");
        return;
      }

      // 3. Lấy chi tiết các lần thất bại
      const failedLogs = await AccessLog.find({
        device_id: deviceId,
        result: "failed",
        createdAt: { $gte: startTime, $lte: endTime },
        access_method: { $in: ["rfid", "fingerprint", "face"] },
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("user_id", "fullName")
        .lean();

      // 4. Tạo nội dung cảnh báo
      const alertTitle = "⚠️ Cảnh báo bảo mật - Khóa cửa thông minh";
      const alertMessage = `Phát hiện ${failedCount} lần mở khóa thất bại liên tiếp trong ${
        this.TIME_WINDOW_MINUTES
      } phút tại thiết bị ${device.type || deviceId}`;

      // 5. Tạo payload chi tiết
      const alertPayload = {
        type: "security_alert",
        severity: "high",
        deviceId: deviceId,
        deviceName: device.type || "Smart Lock",
        failedAttempts: failedCount,
        timeWindow: `${this.TIME_WINDOW_MINUTES} phút`,
        timestamp: new Date().toISOString(),
        details: failedLogs.map((log) => ({
          method: log.access_method,
          time: log.createdAt,
          reason: log.additional_info,
          userName: log.user_id?.fullName || "Không xác định",
        })),
        message: alertMessage,
        actionRequired: "Vui lòng kiểm tra thiết bị và log truy cập",
      };

      // 6. ✅ LƯU NOTIFICATION VÀO DATABASE cho từng user_manager
      const savedNotifications = [];

      const notification = await Notification.create({
        user_id: manager._id.toString(),
        notification_type: "security_alert", // Loại: cảnh báo bảo mật
        title: alertTitle,
        message: alertMessage,
        is_read: false,
        created_at: new Date(),
        // ✅ Lưu thêm metadata để sau này query dễ dàng
        metadata: {
          deviceId: deviceId,
          deviceName: device.type || "Smart Lock",
          failedAttempts: failedCount,
          severity: "high",
          alertPayload: JSON.stringify(alertPayload), // Lưu full payload
        },
      });

      savedNotifications.push(notification);
      console.log(
        `✅ Đã lưu notification ${notification.id} cho user_manager: ${manager.fullName}`
      );

      // 7. Gửi cảnh báo realtime qua Socket.IO
      if (global.io) {
        global.io.to(`user_${manager._id}`).emit("security_alert", {
          ...alertPayload,
          notificationId: savedNotifications.find(
            (n) => n.user_id === manager._id.toString()
          )?.id,
        });
        console.log(
          `📤 Đã gửi realtime alert đến user_manager: ${manager.fullName}`
        );
      } else {
        console.log("⚠️ Socket.IO chưa được khởi tạo");
      }

      return {
        success: true,
        notificationsSent: savedNotifications.length,
        notifications: savedNotifications,
      };
    } catch (error) {
      console.error("❌ Lỗi gửi cảnh báo bảo mật:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * (Tùy chọn) Tạm khóa thiết bị sau quá nhiều lần thất bại
   * @param {String} deviceId - ID thiết bị
   */
  async temporaryLockDevice(deviceId) {
    try {
      const device = await Device.findOne({ device_id: deviceId });

      if (device && device.status !== "blocked") {
        device.status = "blocked";
        device.metadata = device.metadata || {};
        device.metadata.set("blocked_reason", "Too many failed attempts");
        device.metadata.set("blocked_at", new Date().toISOString());
        await device.save();

        console.log(`🔒 Đã tạm khóa thiết bị ${deviceId}`);

        // Tạo notification cho việc khóa thiết bị
        const managers = await User.find({
          org_id: device.org_id,
          role: "user_manager",
        }).select("_id fullName");

        for (const manager of managers) {
          await Notification.create({
            id: uuidv4(),
            user_id: manager._id.toString(),
            notification_type: "device_blocked",
            title: "🔒 Thiết bị đã bị khóa tự động",
            message: `Thiết bị ${deviceId} đã bị khóa do quá nhiều lần mở khóa thất bại`,
            is_read: false,
            metadata: {
              deviceId: deviceId,
              reason: "Too many failed attempts",
              blockedAt: new Date().toISOString(),
            },
          });
        }

        // Gửi thông báo khóa thiết bị qua Socket.IO
        if (global.io) {
          global.io.emit("device_blocked", {
            deviceId: deviceId,
            reason: "Too many failed attempts",
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error("❌ Lỗi khóa thiết bị:", error);
    }
  }

  /**
   * Xóa cache cảnh báo (có thể gọi định kỳ)
   */
  clearAlertCache() {
    this.deviceAlertCache.clear();
    console.log("🧹 Đã xóa cache cảnh báo");
  }

  /**
   * ✅ LẤY THỐNG KÊ CẢNH BÁO TỪ NOTIFICATION
   * @param {String} userId - ID của user_manager
   * @param {Number} days - Số ngày thống kê
   */
  async getAlertStatistics(userId, days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Tổng số cảnh báo
      const totalAlerts = await Notification.countDocuments({
        user_id: userId,
        notification_type: "security_alert",
        created_at: { $gte: startDate },
      });

      // Số cảnh báo chưa đọc
      const unreadAlerts = await Notification.countDocuments({
        user_id: userId,
        notification_type: "security_alert",
        is_read: false,
        created_at: { $gte: startDate },
      });

      // Cảnh báo theo thiết bị
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
          },
        },
        {
          $sort: { count: -1 },
        },
      ]);

      return {
        totalAlerts,
        unreadAlerts,
        alertsByDevice,
        period: `${days} ngày qua`,
      };
    } catch (error) {
      console.error("❌ Lỗi lấy thống kê:", error);
      throw error;
    }
  }
}

// Export singleton instance
const securityAlertService = new SecurityAlertService();

// Tự động xóa cache mỗi 1 giờ
setInterval(() => {
  securityAlertService.clearAlertCache();
}, 60 * 60 * 1000);

module.exports = new SecurityAlertService();

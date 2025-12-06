const User = require("../models/user.model");
const Device = require("../models/device.model");
const AccessLog = require("../models/log.model");
const mqttClient = require("../config/mqtt");

// [POST] http://localhost:3000/face/unlock - Mở khoá bằng khuôn mặt
module.exports.unlockByFace = async (req, res) => {
  try {
    const userId = req.user.id;

    const { device_id } = req.body;

    if (!userId || !device_id) {
      return res.status(400).json({
        success: false,
        message: "Thiếu user_id hoặc device_id",
      });
    }

    // ✅ THÊM: Kiểm tra device có tồn tại và đã đăng nhập chưa
    const device = await Device.findOne({ device_id });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Thiết bị không tồn tại trong hệ thống",
      });
    }

    if (device.status !== "online") {
      return res.status(400).json({
        success: false,
        message: "Thiết bị chưa online hoặc chưa đăng nhập",
      });
    }

    // ✅ THÊM: Verify session của device
    const session = mqttClient.verifyDeviceSession(device_id);
    if (!session.valid) {
      return res.status(401).json({
        success: false,
        message: `Thiết bị chưa xác thực: ${session.reason}`,
      });
    }

    // ✅ Gửi lệnh mở khóa xuống ESP32 qua MQTT
    const unlockTopic = `smartlock/device/${device_id}/control/unlock`;
    const unlockPayload = {
      action: "unlock",
      method: "face",
      user_id: userId,
      timestamp: new Date().toISOString(),
    };

    console.log("📤 Đang gửi lệnh mở khóa...");
    console.log("Topic:", unlockTopic);
    console.log("Payload:", unlockPayload);

    mqttClient.publish(unlockTopic, unlockPayload);

    console.log("✓ Đã gửi lệnh mở khóa thành công");
    console.log("⏳ Chờ ESP32 xác nhận và gửi log về...");
    console.log("=================================\n");

    res.json({
      success: true,
      message: "Đã gửi lệnh mở khóa thành công",
      data: {
        user_id: userId,
        device_id: device_id,
        method: "face",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("✗ Lỗi mở khóa bằng khuôn mặt:", error);

    res.status(500).json({
      success: false,
      message: "Lỗi server: " + error.message,
    });
  }
};

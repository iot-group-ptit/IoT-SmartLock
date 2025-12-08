const Fingerprint = require("../models/fingerprint.model");
const User = require("../models/user.model");
const Device = require("../models/device.model");
const mqttClient = require("../config/mqtt");

//[POST] http://localhost:3000/fingerprint/enroll - User_manager đăng ký vân tay mới cho user
module.exports.enrollFingerprint = async (req, res) => {
  try {
    const { user_id, device_id } = req.body;

    if (!user_id || !device_id) {
      return res.status(400).json({
        success: false,
        message: "user_id và device_id là bắt buộc",
      });
    }

    // Kiểm tra user có tồn tại không
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy user",
      });
    }

    // ✅ THÊM: Kiểm tra device
    const device = await Device.findOne({ device_id });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Thiết bị không tồn tại",
      });
    }

    if (device.status !== "online") {
      return res.status(400).json({
        success: false,
        message: "Thiết bị chưa online hoặc chưa đăng nhập",
      });
    }

    // ✅ THÊM: Verify session
    const session = mqttClient.verifyDeviceSession(device_id);
    if (!session.valid) {
      return res.status(401).json({
        success: false,
        message: `Thiết bị chưa xác thực: ${session.reason}`,
      });
    }

    // Tìm fingerprint_id trống tiếp theo (giả sử từ 1-127)
    let fingerprintId = null;
    for (let id = 1; id <= 127; id++) {
      const existing = await Fingerprint.findOne({
        fingerprint_id: String(id),
      });
      if (!existing) {
        fingerprintId = id;
        break;
      }
    }

    if (!fingerprintId) {
      return res.status(400).json({
        success: false,
        message: "Bộ nhớ vân tay đã đầy, không còn ID trống",
      });
    }

    // ✅ GỬI VÀO TOPIC RIÊNG CỦA DEVICE
    const command = `ENROLL_FINGERPRINT:${user_id}:${fingerprintId}`;
    const deviceTopic = `smartlock/device/${device_id}/enroll/fingerprint`;

    mqttClient.publish(deviceTopic, command);

    console.log(`✓ Đã gửi lệnh enroll vân tay đến device ${device_id}`);

    res.json({
      success: true,
      message: "Đã gửi lệnh đăng ký vân tay",
      fingerprintId: fingerprintId,
      user_id: user_id,
      device_id: device_id,
      note: "Vui lòng đặt ngón tay vào cảm biến",
    });
  } catch (error) {
    console.error("Lỗi enrollFingerprint:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server: " + error.message,
    });
  }
};

//[DELETE] http://localhost:3000/fingerprint/delete - User_manager xoá vân tay của user
module.exports.deleteFingerprint = async (req, res) => {
  try {
    const { fingerprintId, userId, device_id } = req.body;

    if (!fingerprintId || !userId || !device_id) {
      return res.status(400).json({
        success: false,
        message: "Thiếu fingerprintId, userId hoặc device_id",
      });
    }

    // ✅ THÊM: Kiểm tra device
    const device = await Device.findOne({ device_id });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Thiết bị không tồn tại",
      });
    }

    if (device.status !== "online") {
      return res.status(400).json({
        success: false,
        message: "Thiết bị chưa online hoặc chưa đăng nhập",
      });
    }

    // ✅ THÊM: Verify device session
    const session = mqttClient.verifyDeviceSession(device_id);
    if (!session.valid) {
      return res.status(401).json({
        success: false,
        message: `Thiết bị chưa xác thực: ${session.reason}`,
      });
    }

    // Kiểm tra vân tay có tồn tại trong database không
    const fingerprint = await Fingerprint.findOne({
      fingerprint_id: String(fingerprintId),
      user_id: userId,
      device_id: device_id,
    });

    if (!fingerprint) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy vân tay này của người dùng",
      });
    }

    // ✅ GỬI VÀO TOPIC RIÊNG
    const deleteCommand = `DELETE_FINGERPRINT:${userId}:${fingerprintId}`;
    const deviceTopic = `smartlock/device/${device_id}/delete/fingerprint`;

    mqttClient.publish(deviceTopic, deleteCommand, { qos: 1 });

    console.log(`📤 Đã gửi lệnh xóa vân tay xuống ESP32: ${deleteCommand}`);

    res.json({
      success: true,
      message: "Đã gửi lệnh xóa vân tay",
      fingerprintId: fingerprintId,
      userId: userId,
      device_id: device_id,
    });
  } catch (error) {
    console.error("Lỗi xóa vân tay:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server: " + error.message,
    });
  }
};

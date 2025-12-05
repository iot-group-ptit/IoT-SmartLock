const Fingerprint = require("../models/fingerprint.model");
const User = require("../models/user.model");
const mqttClient = require("../config/mqtt");

//[POST] http://localhost:3000/fingerprint/enroll - User_manager đăng ký vân tay mới cho user
module.exports.enrollFingerprint = async (req, res) => {
  try {
    const { user_id } = req.body;

    // Validate user_id
    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "user_id là bắt buộc",
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

    // Gửi lệnh đăng ký vân tay xuống ESP32 qua MQTT
    const command = `ENROLL_FINGERPRINT:${user_id}:${fingerprintId}`;
    mqttClient.publish(mqttClient.topics.ENROLL_FINGERPRINT, command);

    console.log(`📤 Đã gửi lệnh đăng ký vân tay xuống ESP32`);
    console.log(`   User ID: ${user_id}`);
    console.log(`   Fingerprint ID: ${fingerprintId}`);

    // Trả response cho app
    res.json({
      success: true,
      message: "Đã gửi lệnh đăng ký vân tay xuống thiết bị",
      fingerprintId: fingerprintId,
      user_id: user_id,
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
    const { fingerprintId, userId } = req.body;

    // Validate input
    if (!fingerprintId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu fingerprintId hoặc userId",
      });
    }

    // Kiểm tra vân tay có tồn tại trong database không
    const fingerprint = await Fingerprint.findOne({
      fingerprint_id: String(fingerprintId),
      user_id: userId,
    });

    if (!fingerprint) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy vân tay này của người dùng",
      });
    }

    // Gửi lệnh xóa xuống ESP32 qua MQTT
    const deleteCommand = `DELETE_FINGERPRINT:${userId}:${fingerprintId}`;
    mqttClient.publish(mqttClient.topics.DELETE_FINGERPRINT, deleteCommand, {
      qos: 1,
    });

    console.log(`📤 Đã gửi lệnh xóa vân tay xuống ESP32: ${deleteCommand}`);

    // Trả về response ngay lập tức
    // Kết quả thực tế sẽ được gửi qua Socket.IO sau khi ESP32 xác nhận
    res.json({
      success: true,
      message: "Đã gửi lệnh xóa vân tay. Vui lòng chờ xác nhận từ thiết bị.",
      fingerprintId: fingerprintId,
      userId: userId,
    });
  } catch (error) {
    console.error("Lỗi xóa vân tay:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server: " + error.message,
    });
  }
};

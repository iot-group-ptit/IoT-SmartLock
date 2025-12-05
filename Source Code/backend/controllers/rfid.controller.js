const RFIDCard = require("../models/rfid.model");
const User = require("../models/user.model");
const AccessLog = require("../models/log.model");
const BiometricData = require("../models/BiometricData");
const Device = require("../models/device.model");
const mqttClient = require("../config/mqtt");

//[POST] http://localhost:3000/rfid/enroll - User_manager đăng ký thẻ RFID mới cho user
module.exports.enrollRFID = async (req, res) => {
  try {
    const { userId, device_id } = req.body;

    if (!userId || !device_id) {
      return res.status(400).json({
        success: false,
        message: "userId và device_id là bắt buộc",
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

    console.log(`✓ Device ${device_id} đã xác thực - Cho phép enroll`);

    // ✅ GỬI LỆNH ENROLL với device_id cụ thể
    const enrollCommand = `ENROLL_RFID:${userId}`;

    // ✅ Gửi vào topic riêng của device
    const deviceTopic = `smartlock/device/${device_id}/enroll/rfid`;
    mqttClient.publish(deviceTopic, enrollCommand);

    res.json({
      success: true,
      message: "Đã gửi yêu cầu enroll thẻ RFID đến thiết bị",
      userId: userId,
      device_id: device_id,
      instruction: "Lắng nghe event 'rfid_enroll_result' qua Socket.IO",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Lỗi server: " + err.message,
    });
  }
};

//[DELETE] http://localhost:3000/rfid/delete - User_manager xóa thẻ RFID của user
module.exports.deleteRFID = async (req, res) => {
  try {
    const { cardId, userId } = req.body;

    // Validate input
    if (!cardId && !userId) {
      return res.status(400).json({
        success: false,
        message: "Cần cung cấp cardId hoặc userId để xóa thẻ",
      });
    }

    // Tạo query filter
    let filter = {};

    if (cardId && userId) {
      // Xóa thẻ cụ thể của user cụ thể
      filter = {
        $or: [{ card_id: cardId }, { uid: cardId }],
        user_id: userId,
      };
    } else if (cardId) {
      // Xóa thẻ theo cardId hoặc uid
      filter = {
        $or: [{ card_id: cardId }, { uid: cardId }],
      };
    } else if (userId) {
      // Xóa tất cả thẻ của user (nếu cần)
      filter = { user_id: userId };
    }

    // Tìm và xóa thẻ
    const deletedCard = await RFIDCard.findOneAndDelete(filter);

    if (!deletedCard) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thẻ RFID cần xóa",
      });
    }

    console.log(
      `✓ Đã xóa thẻ RFID: ${deletedCard.uid} của user: ${deletedCard.user_id}`
    );

    // Trả về response
    res.json({
      success: true,
      message: "Xóa thẻ RFID thành công!",
      data: {
        cardId: deletedCard.card_id,
        uid: deletedCard.uid,
        userId: deletedCard.user_id.toString(),
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Lỗi xóa thẻ RFID:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server: " + error.message,
    });
  }
};

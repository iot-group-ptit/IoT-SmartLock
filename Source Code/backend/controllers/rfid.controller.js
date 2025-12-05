const RFIDCard = require("../models/rfid.model");
const User = require("../models/user.model");
const AccessLog = require("../models/log.model");
const BiometricData = require("../models/BiometricData");
const Device = require("../models/device.model");
const mqttClient = require("../config/mqtt");

//[POST] http://localhost:3000/rfid/enroll - User_manager đăng ký thẻ RFID mới cho user
module.exports.enrollRFID = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId là bắt buộc" });
    }

    // Gửi lệnh enroll đến ESP32 qua MQTT
    mqttClient.publish(mqttClient.topics.ENROLL_RFID, `ENROLL_RFID:${userId}`);

    res.json({
      success: true,
      message:
        "Đã gửi yêu cầu enroll thẻ RFID đến thiết bị. Vui lòng đặt thẻ lên cảm biến.",
      userId: userId,
      // ✅ App sẽ dùng Socket.IO để lắng nghe kết quả
      instruction:
        "Lắng nghe event 'rfid_enroll_result' qua Socket.IO để nhận kết quả",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server" });
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

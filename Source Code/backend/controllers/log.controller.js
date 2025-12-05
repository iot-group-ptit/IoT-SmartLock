const RFIDCard = require("../models/rfid.model");
const User = require("../models/user.model");
const AccessLog = require("../models/log.model");
const BiometricData = require("../models/BiometricData");
const Device = require("../models/device.model");
const mqttClient = require("../config/mqtt");

//[GET] http://localhost:3000/log - Lấy ra danh sách log truy cập
module.exports.getAllAccessLogs = async (req, res) => {
  try {
    const logs = await AccessLog.find()
      .sort({ createdAt: -1 }) // mới nhất trước
      .populate("user_id", "fullName email")
      .populate("device_id", "name location");

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error("Lỗi lấy AccessLog:", error.message);
    res.status(500).json({
      success: false,
      message: "Lỗi lấy AccessLog",
    });
  }
};

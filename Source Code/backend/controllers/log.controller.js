const RFIDCard = require("../models/rfid.model");
const User = require("../models/user.model");
const AccessLog = require("../models/log.model");
const BiometricData = require("../models/BiometricData");
const Device = require("../models/device.model");
const mqttClient = require("../config/mqtt");

//[GET] http://localhost:3000/log - Lấy ra danh sách log truy cập
module.exports.getAllAccessLogs = async (req, res) => {
  try {
    const manager = req.user; // Lấy từ token decode
    const { deviceId } = req.params;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu deviceId!",
      });
    }

    // 1. Lấy các user con
    const childUsers = await User.find({
      parent_id: manager.id,
      role: "user",
    }).select("_id");

    const childUserIds = childUsers.map((u) => u._id.toString());

    // 2. Danh sách user hợp lệ
    const allowedUserIds = [manager.id, ...childUserIds];

    // 3. Lấy log theo device + (user hợp lệ hoặc user null)
    const logs = await AccessLog.find({
      device_id: deviceId,
      $or: [
        { user_id: { $in: allowedUserIds } }, // log của manager và user con
        { user_id: null }, // log thất bại (không có user)
      ],
    })
      .sort({ createdAt: -1 })
      .populate("user_id", "fullName email role")
      .populate("device_id", "name location");

    return res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error("Lỗi lấy AccessLog:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi lấy AccessLog",
    });
  }
};

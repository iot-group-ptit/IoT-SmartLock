const Device = require("../models/device.model");
const AccessLog = require("../models/log.model");
const crypto = require("crypto");
const mqttClient = require("../config/mqtt"); // ✅ THÊM DÒNG NÀY

// [POST] http://localhost:3000/device/register - User_manager đăng ký thiết bị mới
module.exports.registerDevice = async (req, res) => {
  try {
    const { device_id, type, model, org_id } = req.body;

    // ✅ Validation
    if (!device_id || device_id.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "device_id không được để trống",
      });
    }

    // Kiểm tra device đã tồn tại chưa
    const existing = await Device.findOne({ device_id });
    if (existing) {
      if (existing.status === "pending" && existing.provisioning_token) {
        if (new Date() < existing.provisioning_token_expires) {
          return res.status(200).json({
            success: true,
            message: "Device đã tồn tại và token vẫn còn hiệu lực",
            device_id,
            status: existing.status,
            token_expires: existing.provisioning_token_expires,
          });
        } else {
          // Token hết hạn → tạo token mới
          const newToken = crypto.randomBytes(32).toString("hex");
          const newExpires = new Date(Date.now() + 30 * 60 * 1000);

          existing.provisioning_token = newToken;
          existing.provisioning_token_expires = newExpires;
          await existing.save();

          // ✅ SỬA: Gửi token mới xuống ESP32
          mqttClient.publish(mqttClient.topics.DEVICE_PROVISION_TOKEN, {
            device_id,
            provisioning_token: newToken,
            expires_at: newExpires.toISOString(),
          });
          console.log("✓ Đã gửi token MỚI xuống ESP32 (token cũ hết hạn)");

          return res.json({
            success: true,
            message: "Token cũ đã hết hạn, đã tạo token mới và gửi xuống ESP32",
            device_id,
            status: "pending",
            token_expires: newExpires,
          });
        }
      }

      return res.status(400).json({
        success: false,
        message: "Device ID đã được đăng ký hoàn tất",
        status: existing.status,
      });
    }

    // Sinh provisioning token
    const provisioningToken = crypto.randomBytes(32).toString("hex");
    const tokenExpires = new Date(Date.now() + 30 * 60 * 1000);

    // Tạo device record
    const device = await Device.create({
      device_id,
      type: type || "smart_lock",
      model: model || "ESP32_v1",
      org_id,
      status: "pending",
      provisioning_token: provisioningToken,
      provisioning_token_expires: tokenExpires,
    });

    console.log("✓ Device đã tạo:", device_id);
    console.log("✓ Provisioning token:", provisioningToken);

    // ✅ SỬA: GỬI TOKEN XUỐNG ESP32 QUA MQTT
    mqttClient.publish(mqttClient.topics.DEVICE_PROVISION_TOKEN, {
      device_id,
      provisioning_token: provisioningToken,
      expires_at: tokenExpires.toISOString(),
    });
    console.log("✓ Đã gửi token xuống ESP32");

    // ✅ Log action
    try {
      await AccessLog.create({
        access_method: "device_provision_init",
        result: "success",
        device_id: device_id,
        additional_info: "Admin created device and issued provisioning token",
      });
      console.log("✓ Đã log vào AccessLog");
    } catch (logError) {
      console.error(
        "⚠️ Không thể ghi log (không ảnh hưởng chức năng chính):",
        logError.message
      );
    }

    res.json({
      success: true,
      message: "Device đã được tạo và token đã gửi xuống ESP32",
      device_id,
      status: "pending",
      token_expires: tokenExpires,
    });
  } catch (error) {
    console.error("❌ Lỗi tạo device:", error);

    try {
      if (req.body.device_id) {
        await AccessLog.create({
          access_method: "device_provision_init",
          result: "failed",
          device_id: req.body.device_id,
          additional_info: `Error: ${error.message}`,
        });
      }
    } catch (logError) {
      console.error("⚠️ Không thể ghi error log:", logError.message);
    }

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Lỗi server khi tạo device",
        error: error.message,
      });
    }
  }
};

// // ✅ THÊM: API để kiểm tra trạng thái device
// module.exports.getDeviceStatus = async (req, res) => {
//   try {
//     const { device_id } = req.params;

//     const device = await Device.findOne({ device_id });

//     if (!device) {
//       return res.status(404).json({
//         success: false,
//         message: "Device không tồn tại",
//       });
//     }

//     res.json({
//       success: true,
//       device: {
//         device_id: device.device_id,
//         status: device.status,
//         type: device.type,
//         model: device.model,
//         last_seen: device.last_seen,
//         has_certificate: !!device.certificate,
//         created_at: device.createdAt,
//       },
//     });
//   } catch (error) {
//     console.error("❌ Lỗi get device status:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

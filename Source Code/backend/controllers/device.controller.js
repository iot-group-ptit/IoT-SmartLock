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

          //   // ✅ SỬA: Gửi token mới xuống ESP32
          //   mqttClient.publish(mqttClient.topics.DEVICE_PROVISION_TOKEN, {
          //     device_id,
          //     provisioning_token: newToken,
          //     expires_at: newExpires.toISOString(),
          //   });
          //   console.log("✓ Đã gửi token MỚI xuống ESP32 (token cũ hết hạn)");

          // ✅ SỬA: GỬI TOKEN LÊN TOPIC RIÊNG CỦA DEVICE
          const deviceTopic = `smartlock/device/${device_id}/provision/token`;
          mqttClient.publish(deviceTopic, {
            device_id,
            provisioning_token: newToken,
            expires_at: newExpires.toISOString(),
          });
          console.log(
            `✓ Đã gửi token MỚI xuống ESP32 qua topic: ${deviceTopic}`
          );

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

    // ✅ BƯỚC 1: GỬI CA CERTIFICATE TRƯỚC
    const certificateService = require("../services/certificate.service");
    const caCertPem = certificateService.getCACertificate();

    const caCertTopic = `smartlock/device/${device_id}/ca_certificate`;
    mqttClient.publish(caCertTopic, {
      device_id,
      ca_certificate: caCertPem,
      timestamp: new Date().toISOString(),
    });
    console.log(`✓ Đã gửi CA Certificate cho device: ${device_id}`);

    // Delay nhỏ để ESP32 xử lý CA cert
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // // ✅ SỬA: GỬI TOKEN XUỐNG ESP32 QUA MQTT
    // mqttClient.publish(mqttClient.topics.DEVICE_PROVISION_TOKEN, {
    //   device_id,
    //   provisioning_token: provisioningToken,
    //   expires_at: tokenExpires.toISOString(),
    // });
    // console.log("✓ Đã gửi token xuống ESP32");

    // ✅ SỬA: GỬI TOKEN LÊN TOPIC RIÊNG CỦA DEVICE
    const deviceTopic = `smartlock/device/${device_id}/provision/token`;
    mqttClient.publish(deviceTopic, {
      device_id,
      provisioning_token: provisioningToken,
      expires_at: tokenExpires.toISOString(),
    });
    console.log(`✓ Đã gửi token xuống ESP32 qua topic: ${deviceTopic}`);

    // ✅ Log action
    await AccessLog.create({
      access_method: "device_provision_init",
      result: "success",
      device_id: device_id,
      additional_info: "Admin created device and issued provisioning token",
    });
    res.json({
      success: true,
      message: "Device đã được tạo, CA cert và token đã gửi xuống ESP32",
      device_id,
      status: "pending",
      token_expires: tokenExpires,
    });
  } catch (error) {
    console.error("❌ Lỗi tạo device:", error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Lỗi server khi tạo device",
        error: error.message,
      });
    }
  }
};

// ============================================
// THÊM API ĐỂ LẤY CA CERTIFICATE (TÙY CHỌN)
// ============================================

// File: device.controller.js

module.exports.getCACertificate = async (req, res) => {
  try {
    const certificateService = require("../services/certificate.service");
    const caCertPem = certificateService.getCACertificate();

    res.json({
      success: true,
      ca_certificate: caCertPem,
    });
  } catch (error) {
    console.error("Lỗi lấy CA certificate:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy CA certificate",
      error: error.message,
    });
  }
};

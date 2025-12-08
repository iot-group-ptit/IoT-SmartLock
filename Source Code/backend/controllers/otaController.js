// controllers/otaController.js
const Firmware = require("../models/Firmware");
const FirmwareUpdate = require("../models/FirmwareUpdate");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const mqttService = require("../config/mqtt");

const OTA_PRIVATE_KEY = fs.readFileSync(path.join(__dirname, "../keys/ota_sign.key"));

class OTAController {
  static async upload(req, res) {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: "Không có file" });

      const fileBuffer = fs.readFileSync(req.file.path);
      const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      const sign = crypto.createSign("SHA256");
      sign.update(hash);
      sign.end();
      const signature = sign.sign(OTA_PRIVATE_KEY, "base64");

      const firmware = await Firmware.create({
        version: req.body.version,
        file_name: req.file.filename,
        file_size: req.file.size,
        sha256: hash,
        signature,
        uploaded_by: req.user._id,
        release_note: req.body.release_note
      });

      res.json({ success: true, message: "Upload thành công!", firmware });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async push(req, res) {
    const { device_ids, version } = req.body;
    const firmware = await Firmware.findOne({ version, is_active: true });
    if (!firmware) return res.status(404).json({ success: false, message: "Firmware không tồn tại" });

    const url = `http://localhost:3000/api/ota/download/${firmware._id}`;
    const update_id = `OTA_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    for (const dev of device_ids) {
      await FirmwareUpdate.create({
        update_id,
        device_id: dev,
        from_version: "unknown",
        to_version: firmware.version,
        status: "pending",
        uploaded_by: req.user._id,
        firmware_ref: firmware._id,
        start_ts: new Date()
      });

      mqttService.publish(`smartlock/device/${dev}/ota/command`, JSON.stringify({
        update_id,
        url,
        signature: firmware.signature,
        sha256: firmware.sha256,
        version: firmware.version,
        size: firmware.file_size
      }), { qos: 2 });
    }

    res.json({ success: true, pushed_to: device_ids.length, update_id });
  }

  // controllers/otaController.js → chỉ sửa hàm download thôi
  static async download(req, res) {
    try {
      const firmware = await Firmware.findById(req.params.id);
      if (!firmware) return res.status(404).send("Firmware not found");

      const filePath = path.join(__dirname, "../../uploads/firmware", firmware.file_name);

      if (!fs.existsSync(filePath)) {
        console.error("File không tồn tại:", filePath);
        return res.status(404).send("File .bin không tồn tại trên server");
      }

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${firmware.file_name}"`);
      
      console.log(`Đã gửi firmware: ${firmware.file_name} (${firmware.file_size} bytes)`);
      return res.sendFile(filePath);

    } catch (err) {
      console.error("Download error:", err);
      res.status(500).send("Server error");
    }
  }

  static async reportProgress(data) {
    await FirmwareUpdate.findOneAndUpdate(
      { update_id: data.update_id },
      {
        progress: data.percent,
        message: data.message,
        status: data.percent === 100 ? "completed" : data.percent === 0 ? "failed" : "in_progress",
        end_ts: data.percent >= 100 || data.percent === 0 ? new Date() : null
      }
    );
    global.io?.emit("ota_progress", data);
  }
}

module.exports = OTAController;
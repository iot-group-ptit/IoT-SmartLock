const mqtt = require("mqtt");
const AccessLog = require("../models/log.model");
const RFIDCard = require("../models/rfid.model");
const Fingerprint = require("../models/fingerprint.model");
const User = require("../models/user.model");
const Device = require("../models/device.model");
const securityAlertService = require("../services/securityAlert.service");
const certificateService = require("../services/certificate.service");
const crypto = require("crypto");

class MQTTService {
  constructor() {
    this.client = null;
    this.isConnected = false;

    this.config = {
      broker: "6c6c58328eae454b8e3f8680129d7d32.s1.eu.hivemq.cloud",
      port: 8883,
      username: "smart_lock_nhom7_iot",
      password: "Nhom7iot",
      protocol: "mqtts",
    };

    // Định nghĩa các topic
    this.topics = {
      FINGERPRINT: "smartlock/sensor/fingerprint",
      RFID: "smartlock/sensor/rfid",
      CHECK_RFID: "smartlock/check/rfid",
      FACE: "smartlock/sensor/face",
      STATUS: "smartlock/status",
      CONTROL: "smartlock/control",
      UNLOCK: "smartlock/control/unlock",
      LOCK: "smartlock/control/lock",
      FACE_UNLOCK: "smartlock/sensor/face/unlock",
      ENROLL_RFID: "smartlock/enroll/rfid",
      ENROLL_FINGERPRINT: "smartlock/enroll/fingerprint",
      ENROLL_FINGERPRINT_RESULT: "smartlock/enroll/fingerprint/result",
      ENROLL_START: "smartlock/enroll/start",
      ENROLL_SUCCESS: "smartlock/enroll/success",
      ENROLL_FAILED: "smartlock/enroll/failed",
      DELETE_FINGERPRINT: "smartlock/delete/fingerprint",
      DELETE_FINGERPRINT_RESULT: "smartlock/delete/fingerprint/result",
      DEVICE_PROVISION_TOKEN: "smartlock/device/provision/token",
      DEVICE_PROVISION_REQUEST: "smartlock/device/provision/request",
      DEVICE_PROVISION_RESPONSE: "smartlock/device/provision/response",
      DEVICE_FINALIZE_REQUEST: "smartlock/device/finalize/request",
      DEVICE_FINALIZE_RESPONSE: "smartlock/device/finalize/response",
<<<<<<< HEAD
      DEVICE_LOGIN: "smartlock/device/login",
      DEVICE_LOGIN_RESPONSE: "smartlock/device/login/response",
      DEVICE_HEARTBEAT: "smartlock/device/heartbeat",
=======
      // THÊM TOPIC OTA
      OTA_PROGRESS: "smartlock/ota/progress",
>>>>>>> origin/firmware-yen
    };

    // Session storage
    this.deviceSessions = new Map();
    this.SESSION_TIMEOUT = 10 * 60 * 1000; // 10 phút

    // Cleanup mỗi 2 phút
    setInterval(() => this.cleanupExpiredSessions(), 2 * 60 * 1000);
  }

  // Kết nối tới MQTT Broker
  connect(onConnected) {
    const connectUrl = `${this.config.protocol}://${this.config.broker}:${this.config.port}`;

    const options = {
      clientId: `backend_${Math.random().toString(16).slice(3)}`,
      username: this.config.username,
      password: this.config.password,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 1000,
    };

    console.log("Đang kết nối tới MQTT Broker...");
    this.client = mqtt.connect(connectUrl, options);

    // Xử lý sự kiện kết nối thành công
    this.client.on("connect", () => {
      console.log("✓ Đã kết nối thành công tới MQTT Broker");
      this.isConnected = true;

      // Subscribe các topic để nhận dữ liệu từ ESP32
      this.subscribeToTopics();

      // Gọi callback nếu có
      if (onConnected && typeof onConnected === "function") {
        onConnected();
      }
    });

    // Xử lý sự kiện nhận message
    this.client.on("message", (topic, message) => {
      this.handleMessage(topic, message);
    });

    // Xử lý sự kiện lỗi
    this.client.on("error", (error) => {
      console.error("Lỗi MQTT:", error);
      this.isConnected = false;
    });

    // Xử lý sự kiện mất kết nối
    this.client.on("close", () => {
      console.log("Đã ngắt kết nối MQTT");
      this.isConnected = false;
    });

    // Xử lý sự kiện reconnect
    this.client.on("reconnect", () => {
      console.log("Đang thử kết nối lại...");
    });
  }

  // Subscribe các topic
  subscribeToTopics() {
    const topicsToSubscribe = [
      this.topics.FINGERPRINT,
      this.topics.RFID,
      this.topics.CHECK_RFID,
      this.topics.FACE,
      this.topics.STATUS,
      this.topics.FACE_UNLOCK,
      this.topics.ENROLL_RFID,
      this.topics.ENROLL_FINGERPRINT_RESULT,
      this.topics.ENROLL_SUCCESS,
      this.topics.ENROLL_FAILED,
      this.topics.DELETE_FINGERPRINT_RESULT,
      //   this.topics.AUTH_REQUEST,
      this.topics.DEVICE_PROVISION_REQUEST,
      this.topics.DEVICE_FINALIZE_REQUEST,
<<<<<<< HEAD
      "smartlock/device/+/request_ca_cert",
      this.topics.DEVICE_LOGIN,
      this.topics.DEVICE_HEARTBEAT,
=======
      this.topics.OTA_PROGRESS, // THÊM TOPIC OTA PROGRESS
>>>>>>> origin/firmware-yen
    ];

    topicsToSubscribe.forEach((topic) => {
      this.client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`Lỗi subscribe topic ${topic}:`, err);
        } else {
          console.log(`✓ Đã subscribe topic: ${topic}`);
        }
      });
    });
  }

  // Subscribe topic tùy chỉnh với callback
  subscribe(topic, callback) {
    if (!this.isConnected) {
      console.error("Chưa kết nối tới MQTT Broker");
      return;
    }

    this.client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        console.error(`Lỗi subscribe topic ${topic}:`, err);
      } else {
        console.log(`✓ Đã subscribe custom topic: ${topic}`);

        // Tạo listener riêng cho custom topic
        const messageHandler = (receivedTopic, message) => {
          if (this.topicMatch(receivedTopic, topic)) {
            try {
              const payload = JSON.parse(message.toString());
              callback(receivedTopic, payload);
            } catch (error) {
              callback(receivedTopic, message.toString());
            }
          }
        };

        // Thêm listener vào client
        this.client.on("message", messageHandler);
      }
    });
  }

  // Helper function để match topic với wildcard
  topicMatch(topic, pattern) {
    const topicParts = topic.split("/");
    const patternParts = pattern.split("/");

    if (patternParts.length !== topicParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] !== "+" && patternParts[i] !== topicParts[i]) {
        return false;
      }
    }

    return true;
  }

  async handleDeviceLogin(data) {
    console.log("\n=================================");
    console.log("🔐 XỬ LÝ DEVICE LOGIN REQUEST");
    console.log("=================================");
    console.log("Dữ liệu:", data);

    const { device_id, timestamp, signature } = data;

    try {
      // ✅ Validation
      if (!device_id || !timestamp || !signature) {
        console.log("✗ Thiếu thông tin");
        return this.publish(this.topics.DEVICE_LOGIN_RESPONSE, {
          device_id: device_id || "unknown",
          success: false,
          reason: "Missing required fields",
        });
      }

      // ✅ Tìm device trong database
      const device = await Device.findOne({ device_id });

      if (!device) {
        console.log("✗ Device không tồn tại");
        return this.publish(this.topics.DEVICE_LOGIN_RESPONSE, {
          device_id,
          success: false,
          reason: "Device not found",
        });
      }

      if (!device.certificate) {
        console.log("✗ Device chưa có certificate");
        console.log("Status hiện tại:", device.status);
        return this.publish(this.topics.DEVICE_LOGIN_RESPONSE, {
          device_id,
          success: false,
          reason: "Device not registered. Please complete provisioning first.",
        });
      }

      console.log("✓ Device có certificate - Cho phép login");
      console.log("Status trước khi login:", device.status);

      // ✅ Kiểm tra certificate còn hạn không (optional)
      if (
        device.certificate_expires &&
        new Date() > device.certificate_expires
      ) {
        console.log("✗ Certificate đã hết hạn");
        return this.publish(this.topics.DEVICE_LOGIN_RESPONSE, {
          device_id,
          success: false,
          reason: "Certificate expired. Please re-register device.",
        });
      }

      // ✅ Verify signature
      console.log("🔍 Đang verify signature...");

      if (!device.public_key) {
        console.log("✗ Không tìm thấy public key");
        return this.publish(this.topics.DEVICE_LOGIN_RESPONSE, {
          device_id,
          success: false,
          reason: "Public key not found",
        });
      }

      // Verify timestamp signature
      const verify = crypto.createVerify("SHA256");
      verify.update(String(timestamp));
      verify.end();

      let isValid = false;
      try {
        isValid = verify.verify(
          device.public_key,
          Buffer.from(signature, "base64")
        );
      } catch (verifyError) {
        console.error("✗ Lỗi verify:", verifyError.message);
        return this.publish(this.topics.DEVICE_LOGIN_RESPONSE, {
          device_id,
          success: false,
          reason: "Signature verification error",
        });
      }

      if (!isValid) {
        console.log("✗ Signature không hợp lệ");

        // Log failed attempt
        await AccessLog.create({
          access_method: "device_login",
          result: "failed",
          device_id: device_id,
          additional_info: "Invalid signature",
        });

        return this.publish(this.topics.DEVICE_LOGIN_RESPONSE, {
          device_id,
          success: false,
          reason: "Invalid signature",
        });
      }

      console.log("✓ Signature hợp lệ!");

      // ✅ Kiểm tra timestamp dựa theo loại: epoch ms vs. device millis
      const ts = Number(timestamp);
      const isEpochMillis = ts > 1e12; // epoch ms thường >= 1,000,000,000,000

      if (isEpochMillis) {
        const timestampAge = Date.now() - ts;

        // Không quá 5 phút trong quá khứ
        if (timestampAge > 5 * 60 * 1000) {
          console.log("✗ Timestamp quá cũ (possible replay attack)");
          return this.publish(this.topics.DEVICE_LOGIN_RESPONSE, {
            device_id,
            success: false,
            reason: "Timestamp too old",
          });
        }

        // Không quá 1 phút trong tương lai
        if (timestampAge < -60 * 1000) {
          console.log("✗ Timestamp trong tương lai");
          return this.publish(this.topics.DEVICE_LOGIN_RESPONSE, {
            device_id,
            success: false,
            reason: "Invalid timestamp",
          });
        }
      } else {
        // Timestamp là millis() của thiết bị → không so với Date.now()
        // Optional: chống replay đơn giản bằng cách ghi nhớ last timestamp theo device và yêu cầu tăng dần
        const sessionInfo = this.deviceSessions.get(device_id);
        if (
          sessionInfo &&
          typeof sessionInfo.last_device_timestamp === "number"
        ) {
          const lastTs = sessionInfo.last_device_timestamp;
          // Cho phép timestamp tăng dần và khác biệt không quá lớn (ví dụ < 10 phút thiết bị)
          if (ts < lastTs) {
            console.log(
              "⚠️ Timestamp thiết bị nhỏ hơn lần trước (có thể reboot) → vẫn chấp nhận."
            );
          }
        }
      }

      // ✅ Tạo session token
      const sessionToken = crypto.randomBytes(32).toString("hex");

      // ✅ Lưu session
      this.deviceSessions.set(device_id, {
        session_token: sessionToken,
        device_id: device_id,
        logged_in_at: new Date(),
        last_heartbeat: new Date(),
        last_device_timestamp: ts,
        status: "online",
      });

      // ✅ Cập nhật device trong database
      device.status = "online";
      device.last_seen = new Date();
      await device.save();

      console.log("✓ Device đăng nhập thành công:", device_id);
      console.log("✓ Session token:", sessionToken.substring(0, 16) + "...");
      console.log("✓ Status sau khi login:", device.status);
      console.log("✓ Phương thức: X.509 Certificate Signature");

      //   // ✅ Gửi response
      //   this.publish(this.topics.DEVICE_LOGIN_RESPONSE, {
      //     device_id,
      //     success: true,
      //     session_token: sessionToken,
      //     message: "Login successful",
      //     timestamp: new Date().toISOString(),
      //     auth_method: "x509_signature",
      //   });

      // ✅ Gửi response (QUAN TRỌNG: Kiểm tra payload size)
      const responsePayload = {
        device_id,
        success: true,
        session_token: sessionToken,
        message: "Login successful",
        timestamp: new Date().toISOString(),
        auth_method: "x509_signature",
      };

      console.log("\n📤 Response payload:");
      console.log(JSON.stringify(responsePayload));
      console.log(
        "📋 Payload size:",
        JSON.stringify(responsePayload).length,
        "bytes"
      );

      this.publish(this.topics.DEVICE_LOGIN_RESPONSE, responsePayload);

      // ✅ Log thành công
      await AccessLog.create({
        access_method: "device_login",
        result: "success",
        device_id: device_id,
        additional_info: "Device authenticated successfully",
      });

      // ✅ Gửi thông báo lên app
      if (global.io) {
        global.io.emit("device_status", {
          device_id,
          status: "online",
          logged_in_at: new Date(),
          auth_method: "x509_signature",
        });
      }

      console.log("=================================\n");
    } catch (error) {
      console.error("✗ Lỗi xử lý login:", error);

      await AccessLog.create({
        access_method: "device_login",
        result: "failed",
        device_id: device_id,
        additional_info: `Login error: ${error.message}`,
      });

      this.publish(this.topics.DEVICE_LOGIN_RESPONSE, {
        device_id,
        success: false,
        reason: "Server error: " + error.message,
      });
    }
  }

  async handleDeviceHeartbeat(data) {
    const { device_id, session_token, status } = data;

    try {
      // ✅ Kiểm tra session
      const session = this.deviceSessions.get(device_id);

      if (!session) {
        console.log(
          `⚠️ Device ${device_id} không có session - yêu cầu login lại`
        );

        // Gửi yêu cầu login lại
        this.publish(`smartlock/device/${device_id}/reauth`, {
          device_id,
          reason: "Session not found. Please login again.",
        });

        return;
      }

      // ✅ Verify session token
      if (session.session_token !== session_token) {
        console.log(`✗ Session token không hợp lệ cho ${device_id}`);

        // Xóa session cũ
        this.deviceSessions.delete(device_id);

        // Yêu cầu login lại
        this.publish(`smartlock/device/${device_id}/reauth`, {
          device_id,
          reason: "Invalid session token. Please login again.",
        });

        return;
      }

      // ✅ Cập nhật heartbeat
      session.last_heartbeat = new Date();
      session.status = status || "online";
      this.deviceSessions.set(device_id, session);

      // ✅ Cập nhật database
      await Device.findOneAndUpdate(
        { device_id },
        {
          last_seen: new Date(),
          status: status || "online",
        }
      );

      console.log(
        `💓 Heartbeat từ ${device_id} - Status: ${status || "online"}`
      );

      // ✅ Gửi thông báo lên app (nếu status thay đổi)
      if (global.io && status) {
        global.io.emit("device_status", {
          device_id,
          status: status,
          last_seen: new Date(),
        });
      }
    } catch (error) {
      console.error(`✗ Lỗi xử lý heartbeat từ ${device_id}:`, error);
    }
  }

  async cleanupExpiredSessions() {
    console.log("\n🧹 Cleaning up expired sessions...");

    const now = Date.now();
    let cleanedCount = 0;

    for (const [device_id, session] of this.deviceSessions.entries()) {
      const timeSinceHeartbeat =
        now - new Date(session.last_heartbeat).getTime();

      // Nếu không heartbeat trong 10 phút → xóa session
      if (timeSinceHeartbeat > this.SESSION_TIMEOUT) {
        this.deviceSessions.delete(device_id);
        cleanedCount++;

        console.log(`✓ Removed expired session: ${device_id}`);

        // Cập nhật status trong database
        await Device.findOneAndUpdate(
          { device_id },
          {
            last_seen: new Date(),
          }
        );

        // Gửi thông báo lên app (optional)
        if (global.io) {
          global.io.emit("device_status", {
            device_id,
            status: "session_expired",
            reason: "No heartbeat received",
            last_seen: new Date(),
          });
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`✓ Cleaned ${cleanedCount} expired session(s)`);
    }
  }

  verifyDeviceSession(device_id, session_token) {
    const session = this.deviceSessions.get(device_id);

    if (!session) {
      console.log(`⚠️ Device ${device_id} không có session`);
      return {
        valid: false,
        reason: "Session not found. Please login.",
      };
    }

    if (session_token && session.session_token !== session_token) {
      console.log(`✗ Session token không hợp lệ cho ${device_id}`);
      return {
        valid: false,
        reason: "Invalid session token",
      };
    }

    // Kiểm tra timeout
    const timeSinceHeartbeat =
      Date.now() - new Date(session.last_heartbeat).getTime();
    if (timeSinceHeartbeat > this.SESSION_TIMEOUT) {
      this.deviceSessions.delete(device_id);
      console.log(`⏱️ Session expired cho ${device_id}`);
      return {
        valid: false,
        reason: "Session expired",
      };
    }

    return { valid: true, session };
  }

  async handleUnlockRequest(data) {
    const { device_id, session_token, user_id } = data;

    // ✅ Verify session
    const verification = await this.verifyDeviceSession(
      device_id,
      session_token
    );

    if (!verification.valid) {
      console.log("✗ Unlock denied:", verification.reason);

      // Yêu cầu login lại
      this.publish(`smartlock/device/${device_id}/reauth`, {
        device_id,
        reason: verification.reason,
      });

      return;
    }

    // ✅ Session hợp lệ → Gửi lệnh unlock
    this.publish(this.topics.UNLOCK, {
      action: "unlock",
      method: "remote",
      user_id: user_id,
      timestamp: new Date().toISOString(),
    });

    console.log(`✓ Unlock command sent to ${device_id}`);
  }

  // --- HÀM LƯU ACCESS LOG ---
  async saveAccessLog({ method, data, deviceId }) {
    try {
      let userId = null;

      // ✅ Xử lý face unlock
      if (method === "face" && data.user_id) {
        userId = data.user_id;
        console.log(`✓ Face unlock cho user: ${userId}`);
      }
      // Xác định userId dựa trên cardUid hoặc fingerprintId
      else if (method === "rfid" && (data.cardUid || data.cardId)) {
        // ✅ Tìm theo uid (cardUid) hoặc card_id
        const card = await RFIDCard.findOne({
          $or: [{ uid: data.cardUid }, { card_id: data.cardId }],
        });
        if (card) {
          userId = card.user_id;
          console.log(
            `✓ Tìm thấy user_id cho thẻ: ${card.uid} -> User: ${userId}`
          );
        } else {
          console.log(`✗ Không tìm thấy thẻ: ${data.cardUid || data.cardId}`);
        }
      } else if (method === "fingerprint" && data.fingerprintId) {
        const fp = await Fingerprint.findOne({
          fingerprint_id: data.fingerprintId,
        });
        if (fp) {
          userId = fp.user_id;
          console.log(
            `✓ Tìm thấy user_id cho vân tay: ${data.fingerprintId} -> User: ${userId}`
          );
        }
      }

      //   let additionalInfo = data.reason || "";
      //   if (method === "face" && data.success) {
      //     additionalInfo =
      //       data.method === "remote" || data.method === "face_app"
      //         ? "Face recognition unlock via mobile app"
      //         : "Face recognition unlock";
      //   }

      const log = await AccessLog.create({
        access_method: method,
        result: data.success ? "success" : "failed",
        user_id: userId || null,
        device_id: deviceId || null,
        additional_info: data.reason || "",
      });

      console.log(
        `✓ Đã lưu access log: ${log._id} (User: ${userId || "NULL"})`
      );

      if (!data.success && deviceId) {
        await securityAlertService.checkFailedAttempts(deviceId, method);
      }

      return log;
    } catch (error) {
      console.error("✗ Lỗi lưu access log:", error);
    }
  }

  // --- Các handler ---
  async handleRFID(data) {
    console.log("💳 Xử lý xác thực RFID...");
    const isValid = data.status === "valid";

    if (isValid) {
      console.log("✓ Thẻ RFID hợp lệ - Mở khóa");
      this.unlockDoor("rfid", data);
    } else {
      console.log("✗ Thẻ RFID không hợp lệ");
      this.publish(this.topics.CONTROL, {
        action: "deny",
        reason: "invalid_card",
      });
    }

    // Lưu log
    await this.saveAccessLog({
      method: "rfid",
      data: { ...data, success: isValid },
      deviceId: data.deviceId,
    });
  }

  // Xử lý enrollment thẻ RFID
  async handleEnrollRFID(data) {
    console.log("💳 Xử lý đăng ký thẻ RFID...");
    const { cardUid, userId, status, device_id } = data;

    if (device_id) {
      const verification = this.verifyDeviceSession(device_id);
      if (!verification.valid) {
        console.log(
          `✗ Device ${device_id} chưa xác thực: ${verification.reason}`
        );

        if (global.io) {
          global.io.to(`user_${userId}`).emit("rfid_enroll_result", {
            success: false,
            message: `Thiết bị chưa xác thực: ${verification.reason}`,
            cardUid: cardUid,
          });
        }
        return;
      }
      console.log(`✓ Device ${device_id} đã xác thực - Tiếp tục enroll`);
    }

    if (status === "success") {
      try {
        const existing = await RFIDCard.findOne({ uid: cardUid });
        if (existing) {
          console.log("✗ Thẻ RFID đã tồn tại!");

          if (global.io) {
            global.io.to(`user_${userId}`).emit("rfid_enroll_result", {
              success: false,
              message: "Thẻ RFID đã được đăng ký trước đó",
              cardUid: cardUid,
            });
          }

          return;
        }

        const newCard = await RFIDCard.create({
          card_id: cardUid,
          uid: cardUid,
          user_id: userId,
          device_id: device_id,
          registered_at: new Date(),
        });

        console.log("✓ Đăng ký thẻ RFID thành công:", newCard);

        if (global.io) {
          global.io.to(`user_${userId}`).emit("rfid_enroll_result", {
            success: true,
            message: "Đăng ký thẻ RFID thành công!",
            cardUid: cardUid,
            cardId: newCard.card_id,
            device_id: device_id,
            registeredAt: newCard.createdAt,
          });
        }
      } catch (err) {
        console.error("✗ Lỗi khi lưu thẻ RFID:", err);

        if (global.io) {
          global.io.to(`user_${userId}`).emit("rfid_enroll_result", {
            success: false,
            message: "Lỗi server: " + err.message,
            cardUid: cardUid,
          });
        }
      }
    } else {
      console.log("✗ Đăng ký thẻ thất bại:", data.reason);
    }
  }

  async handleCheckRFID(data) {
    console.log("💳 Kiểm tra thẻ RFID để mở khóa...");
    const { cardUid, device_id } = data;

    try {
      if (device_id) {
        const verification = this.verifyDeviceSession(device_id);
        if (!verification.valid) {
          console.log(
            `✗ Device ${device_id} chưa xác thực: ${verification.reason}`
          );

          // ✅ Gửi thông báo về ESP32
          this.publish(`smartlock/device/${device_id}/reauth`, {
            device_id,
            reason: verification.reason,
          });

          return;
        }
        console.log(`✓ Device ${device_id} đã xác thực - Tiếp tục check RFID`);
      }

      const card = await RFIDCard.findOne({
        uid: cardUid,
        device_id: device_id,
      }).select("user_id uid card_id");

      if (card) {
        console.log("✓ Thẻ hợp lệ - Gửi lệnh mở khóa");

        const unlockTopic = device_id
          ? `smartlock/device/${device_id}/control/unlock`
          : this.topics.UNLOCK;

        this.publish(unlockTopic, {
          action: "unlock",
          method: "rfid",
          cardUid: cardUid,
          userId: card.user_id.toString(),
          timestamp: new Date().toISOString(),
        });

        // ✅ SỬA: Lưu log với userId đúng format
        await this.saveAccessLog({
          method: "rfid",
          data: {
            cardUid,
            success: true,
            cardId: card.card_id,
          },
          deviceId: device_id,
        });

        console.log("📤 Đã gửi lệnh mở khóa cho thẻ:", cardUid);
      } else {
        console.log("✗ Thẻ không hợp lệ - Từ chối");

        // ✅ GỬI LỆNH TỪ CHỐI
        const controlTopic = device_id
          ? `smartlock/device/${device_id}/control`
          : this.topics.CONTROL;

        this.publish(controlTopic, {
          action: "deny",
          reason: "invalid_card",
          cardUid: cardUid,
        });

        // Lưu log
        await this.saveAccessLog({
          method: "rfid",
          data: {
            cardUid,
            success: false,
            reason: "Card not found or not registered for this device",
          },
          deviceId: device_id,
        });
      }
    } catch (err) {
      console.error("✗ Lỗi kiểm tra thẻ:", err);

      // ✅ Gửi lỗi về ESP32
      if (device_id) {
        this.publish(`smartlock/device/${device_id}/control`, {
          action: "deny",
          reason: "server_error",
          cardUid: cardUid,
        });
      }
    }
  }

  async handleFingerprint(data) {
    console.log("🔐 Xử lý xác thực vân tay...");

    const { fingerprintId, status, device_id } = data;

    // ✅ THÊM: Verify session
    if (device_id) {
      const verification = this.verifyDeviceSession(device_id);
      if (!verification.valid) {
        console.log(
          `✗ Device ${device_id} chưa xác thực: ${verification.reason}`
        );

        // Gửi yêu cầu login lại
        this.publish(`smartlock/device/${device_id}/reauth`, {
          device_id,
          reason: verification.reason,
        });

        return;
      }
      console.log(
        `✓ Device ${device_id} đã xác thực - Tiếp tục xác thực vân tay`
      );
    }

    const isValid = data.status === "valid";

    if (isValid) {
      console.log("✓ Vân tay hợp lệ - Mở khóa");

      // ✅ Gửi unlock vào topic riêng
      const unlockTopic = device_id
        ? `smartlock/device/${device_id}/control/unlock`
        : this.topics.UNLOCK;

      this.publish(unlockTopic, {
        action: "unlock",
        method: "fingerprint",
        fingerprintId: fingerprintId,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.log("✗ Vân tay không hợp lệ");
    }

    // Lưu log
    await this.saveAccessLog({
      method: "fingerprint",
      data: { ...data, success: isValid },
      deviceId: device_id,
    });
  }

  // Thêm handler mới cho kết quả đăng ký vân tay
  async handleEnrollFingerprintResult(data) {
    console.log("🔐 Xử lý kết quả đăng ký vân tay từ ESP32...");
    const { status, fingerprintId, userId, reason, device_id } = data;

    // ✅ THÊM: Verify device session
    if (device_id) {
      const verification = this.verifyDeviceSession(device_id);
      if (!verification.valid) {
        console.log(`✗ Device ${device_id} chưa xác thực`);

        if (global.io) {
          global.io.to(`user_${userId}`).emit("fingerprint_enroll_result", {
            success: false,
            message: `Thiết bị chưa xác thực: ${verification.reason}`,
          });
        }
        return;
      }
    }

    try {
      if (status === "success") {
        // Lưu vân tay vào database
        const fingerprint = await Fingerprint.create({
          fingerprint_id: String(fingerprintId),
          user_id: userId,
          device_id: device_id,
          createdAt: new Date(),
        });

        console.log(
          `✓ Đã lưu vân tay ID ${fingerprintId} cho device ${device_id}`
        );

        // Gửi thông báo thành công lên app qua Socket.IO
        if (global.io) {
          global.io.to(`user_${userId}`).emit("fingerprint_enroll_result", {
            success: true,
            message: "Đăng ký vân tay thành công!",
            fingerprintId: fingerprintId,
            userId: userId,
            device_id: device_id,
            registeredAt: fingerprint.createdAt,
          });
        }
      } else {
        // Đăng ký thất bại
        console.log(`✗ Đăng ký vân tay thất bại: ${reason || "Unknown error"}`);

        // Gửi thông báo thất bại lên app
        if (global.io) {
          global.io.to(`user_${userId}`).emit("fingerprint_enroll_result", {
            success: false,
            message: reason || "Đăng ký vân tay thất bại",
            fingerprintId: fingerprintId,
            userId: userId,
          });
        }
      }
    } catch (error) {
      console.error("✗ Lỗi xử lý kết quả đăng ký vân tay:", error);

      if (global.io) {
        global.io.to(`user_${userId}`).emit("fingerprint_enroll_result", {
          success: false,
          message: "Lỗi server: " + error.message,
          fingerprintId: fingerprintId,
          userId: userId,
        });
      }
    }
  }

  // Thêm vào class MQTTService
  async handleDeleteFingerprintResult(data) {
    console.log("🗑️ Xử lý kết quả xóa vân tay từ ESP32...");
    console.log("Dữ liệu nhận được:", data);

    const { status, fingerprintId, userId, reason, device_id } = data;

    // ✅ THÊM: Verify device session
    if (device_id) {
      const verification = this.verifyDeviceSession(device_id);
      if (!verification.valid) {
        console.log(
          `✗ Device ${device_id} chưa xác thực: ${verification.reason}`
        );

        if (global.io) {
          global.io.to(`user_${userId}`).emit("fingerprint_delete_result", {
            success: false,
            message: `Thiết bị chưa xác thực: ${verification.reason}`,
            fingerprintId: fingerprintId,
            userId: userId,
          });
        }
        return;
      }
      console.log(`✓ Device ${device_id} đã xác thực - Tiếp tục xử lý`);
    }

    try {
      if (status === "success") {
        // Xóa vân tay khỏi database
        const result = await Fingerprint.findOneAndDelete({
          fingerprint_id: String(fingerprintId),
          device_id: device_id,
        });

        if (result) {
          console.log(`✓ Đã xóa vân tay ID ${fingerprintId} khỏi database`);

          // Gửi thông báo thành công lên app qua Socket.IO
          if (global.io) {
            global.io.to(`user_${userId}`).emit("fingerprint_delete_result", {
              success: true,
              message: "Xóa vân tay thành công!",
              fingerprintId: fingerprintId,
              userId: userId,
              device_id: device_id,
            });
          }
        } else {
          console.log(
            `✗ Không tìm thấy vân tay ID ${fingerprintId} trong database`
          );

          if (global.io) {
            global.io.to(`user_${userId}`).emit("fingerprint_delete_result", {
              success: false,
              message: "Không tìm thấy vân tay trong database",
              fingerprintId: fingerprintId,
              userId: userId,
            });
          }
        }
      } else {
        // Xóa thất bại
        console.log(`✗ Xóa vân tay thất bại: ${reason || "Unknown error"}`);

        // Gửi thông báo thất bại lên app
        if (global.io) {
          global.io.to(`user_${userId}`).emit("fingerprint_delete_result", {
            success: false,
            message: reason || "Xóa vân tay thất bại",
            fingerprintId: fingerprintId,
            userId: userId,
            device_id: device_id,
          });
        }
      }
    } catch (error) {
      console.error("✗ Lỗi xử lý kết quả xóa vân tay:", error);

      if (global.io) {
        global.io.to(`user_${userId}`).emit("fingerprint_delete_result", {
          success: false,
          message: "Lỗi server: " + error.message,
          fingerprintId: fingerprintId,
          userId: userId,
        });
      }
    }
  }

  // 3. CẬP NHẬT hàm handleFace() để xử lý cả face recognition từ ESP32
  async handleFace(data) {
    console.log("👤 Xử lý nhận diện khuôn mặt...");
    console.log("Dữ liệu:", data);

    const { device_id, status, method, user_id } = data;

    // ✅ Verify device session
    if (device_id) {
      const verification = this.verifyDeviceSession(device_id);
      if (!verification.valid) {
        console.log(
          `✗ Device ${device_id} chưa xác thực: ${verification.reason}`
        );
        return;
      }
      console.log(`✓ Device ${device_id} đã xác thực`);
    }

    const isValid = status === "valid";

    if (isValid) {
      console.log("✓ Khuôn mặt hợp lệ - Đã mở khóa");

      // Nếu là unlock từ app (method = "remote")
      if (method === "remote" || method === "face_app") {
        console.log("📱 Mở khóa từ app bằng AI face recognition");
      } else {
        console.log("🤖 Mở khóa từ ESP32 (nếu có camera)");
      }
    } else {
      console.log("✗ Khuôn mặt không hợp lệ");
    }

    // ✅ Lưu access log
    await this.saveAccessLog({
      method: "face",
      data: {
        ...data,
        success: isValid,
        user_id: user_id || null,
      },
      deviceId: device_id,
    });

    console.log("✓ Đã lưu access log cho face unlock");

    // ✅ Gửi notification lên app qua Socket.IO
    if (global.io && isValid) {
      global.io.emit("door_unlocked", {
        device_id,
        method: "face",
        user_id: user_id,
        status: "success",
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Handler xử lý khi ESP32 gửi certificate + signature
  async handleDeviceRegisterResponse(data) {
    console.log("📥 Xử lý phản hồi đăng ký từ ESP32...");
    console.log("Dữ liệu:", data);

    const { deviceId, publicKeyPem, signedChallenge } = data;

    try {
      // Tìm device trong DB
      const device = await Device.findOne({ device_id: deviceId });

      if (!device) {
        console.log("✗ Không tìm thấy device:", deviceId);
        return this.publish(this.topics.REG_RESPONSE, {
          deviceId,
          success: false,
          reason: "Device not found",
        });
      }

      if (!device.challenge) {
        console.log("✗ Không tìm thấy challenge cho device:", deviceId);
        return this.publish(this.topics.REG_RESPONSE, {
          deviceId,
          success: false,
          reason: "Challenge not found",
        });
      }

      console.log("🔍 Đang verify chữ ký...");
      console.log("Challenge:", device.challenge);
      console.log("Signed Challenge:", signedChallenge);

      // Verify signature với public key
      const verify = crypto.createVerify("SHA256");
      verify.update(device.challenge);
      verify.end();

      const isValid = verify.verify(
        publicKeyPem,
        Buffer.from(signedChallenge, "base64") // ✅ ESP32 gửi base64
      );

      if (!isValid) {
        console.log("✗ Chữ ký không hợp lệ!");
        return this.publish(this.topics.REG_RESPONSE, {
          deviceId,
          success: false,
          reason: "Invalid signature",
        });
      }

      console.log("✓ Chữ ký hợp lệ!");

      // Tạo certificate đơn giản (hoặc dùng X.509 như phần trước)
      const certificatePem = this.generateSimpleCertificate(
        deviceId,
        publicKeyPem
      );

      // Cập nhật device
      device.certificate = certificatePem;
      device.public_key = publicKeyPem;
      device.status = "registered";
      device.challenge = null; // Xóa challenge sau khi dùng xong
      await device.save();

      console.log("✓ Device đăng ký thành công:", deviceId);

      // Gửi certificate về ESP32
      this.publish(this.topics.REG_RESPONSE, {
        deviceId,
        success: true,
        certificate: certificatePem,
        message: "Device registered successfully",
      });

      // Log vào access log
      await AccessLog.create({
        access_method: "device_register",
        result: "success",
        device_id: deviceId,
        additional_info: "Device registered and certificate issued",
      });
    } catch (error) {
      console.error("✗ Lỗi xử lý đăng ký device:", error);

      this.publish(this.topics.REG_RESPONSE, {
        deviceId,
        success: false,
        reason: error.message,
      });
    }
  }

  async handleDeviceProvisionRequest(data) {
    console.log("📥 ESP32 gửi yêu cầu provision...");
    console.log("Dữ liệu:", data);

    const { device_id, provisioning_token, public_key_pem } = data;

    try {
      // ✅ Validation
      if (!device_id || !provisioning_token || !public_key_pem) {
        console.log("✗ Thiếu thông tin bắt buộc");
        return this.publish(this.topics.DEVICE_PROVISION_RESPONSE, {
          device_id: device_id || "unknown",
          success: false,
          reason:
            "Missing required fields: device_id, provisioning_token, public_key_pem",
        });
      }

      // ✅ UNESCAPE newline trong public key
      const unescapedPublicKey = public_key_pem.replace(/\\n/g, "\n");

      // Tìm device
      const device = await Device.findOne({ device_id });

      if (!device) {
        console.log("✗ Device không tồn tại:", device_id);
        return this.publish(this.topics.DEVICE_PROVISION_RESPONSE, {
          device_id,
          success: false,
          reason: "Device not found in database. Please register device first.",
        });
      }

      // Kiểm tra provisioning token
      if (
        !device.provisioning_token ||
        device.provisioning_token !== provisioning_token
      ) {
        console.log("✗ Provisioning token không hợp lệ");
        console.log(
          "Token từ ESP32:",
          provisioning_token.substring(0, 10) + "..."
        );
        console.log(
          "Token trong DB:",
          device.provisioning_token
            ? device.provisioning_token.substring(0, 10) + "..."
            : "null"
        );

        return this.publish(this.topics.DEVICE_PROVISION_RESPONSE, {
          device_id,
          success: false,
          reason: "Invalid provisioning token",
        });
      }

      // ✅ Kiểm tra token hết hạn
      if (new Date() > device.provisioning_token_expires) {
        console.log("✗ Provisioning token đã hết hạn");
        return this.publish(this.topics.DEVICE_PROVISION_RESPONSE, {
          device_id,
          success: false,
          reason:
            "Provisioning token expired. Please request new token from admin.",
        });
      }

      // ✅ Kiểm tra device đã registered chưa
      if (device.status === "registered" && device.certificate) {
        console.log("⚠️ Device đã được đăng ký rồi");
        return this.publish(this.topics.DEVICE_PROVISION_RESPONSE, {
          device_id,
          success: false,
          reason: "Device already registered",
        });
      }

      // ✅ Validate public key format (SỬA: dùng unescapedPublicKey)
      if (
        !unescapedPublicKey.includes("BEGIN PUBLIC KEY") ||
        !unescapedPublicKey.includes("END PUBLIC KEY")
      ) {
        console.log("✗ Public key format không hợp lệ");
        return this.publish(this.topics.DEVICE_PROVISION_RESPONSE, {
          device_id,
          success: false,
          reason: "Invalid public key format. Must be PEM format.",
        });
      }

      // ✅ Token hợp lệ → Sinh challenge
      const challenge = crypto.randomBytes(32).toString("hex");

      device.challenge = challenge;
      device.challenge_created_at = new Date();
      device.public_key = unescapedPublicKey; // ✅ Lưu public key đã unescape
      await device.save();

      console.log("✓ Provisioning token hợp lệ!");
      console.log("✓ Challenge đã tạo:", challenge.substring(0, 20) + "...");

      // Gửi challenge về ESP32
      this.publish(this.topics.DEVICE_PROVISION_RESPONSE, {
        device_id,
        success: true,
        challenge,
        challenge_expires_in: 300,
        message: "Please sign this challenge with your private key",
      });

      // ✅ Set timeout để xóa challenge sau 5 phút
      setTimeout(async () => {
        const currentDevice = await Device.findOne({ device_id });
        if (
          currentDevice &&
          currentDevice.challenge === challenge &&
          currentDevice.status !== "registered"
        ) {
          currentDevice.challenge = null;
          currentDevice.challenge_created_at = null;
          await currentDevice.save();
          console.log(`⏱️ Challenge timeout cho device ${device_id}`);
        }
      }, 5 * 60 * 1000);
    } catch (error) {
      console.error("✗ Lỗi xử lý provision request:", error);
      this.publish(this.topics.DEVICE_PROVISION_RESPONSE, {
        device_id: device_id || "unknown",
        success: false,
        reason: "Server error: " + error.message,
      });
    }
  }

  // ✅ Handler: ESP32 gửi signed challenge để hoàn tất đăng ký (CẢI TIẾN)
  async handleDeviceFinalizeRequest(data) {
    console.log("📥 ESP32 gửi signed challenge...");
    console.log("Dữ liệu:", data);

    const { device_id, signed_challenge } = data;

    try {
      // ✅ Validation
      if (!device_id || !signed_challenge) {
        console.log("✗ Thiếu thông tin");
        return this.publish(this.topics.DEVICE_FINALIZE_RESPONSE, {
          device_id: device_id || "unknown",
          success: false,
          reason: "Missing device_id or signed_challenge",
        });
      }

      // Tìm device
      const device = await Device.findOne({ device_id });

      if (!device) {
        console.log("✗ Device không tồn tại");
        return this.publish(this.topics.DEVICE_FINALIZE_RESPONSE, {
          device_id,
          success: false,
          reason: "Device not found",
        });
      }

      if (!device.challenge) {
        console.log("✗ Không tìm thấy challenge - có thể đã hết hạn");
        return this.publish(this.topics.DEVICE_FINALIZE_RESPONSE, {
          device_id,
          success: false,
          reason:
            "Challenge not found or expired. Please restart provisioning.",
        });
      }

      if (!device.public_key) {
        console.log("✗ Không tìm thấy public key");
        return this.publish(this.topics.DEVICE_FINALIZE_RESPONSE, {
          device_id,
          success: false,
          reason: "Public key not found",
        });
      }

      // ✅ Kiểm tra challenge timeout (5 phút)
      const challengeAge = new Date() - new Date(device.challenge_created_at);
      if (challengeAge > 5 * 60 * 1000) {
        console.log("✗ Challenge đã hết hạn");
        device.challenge = null;
        device.challenge_created_at = null;
        await device.save();

        return this.publish(this.topics.DEVICE_FINALIZE_RESPONSE, {
          device_id,
          success: false,
          reason: "Challenge expired. Please restart provisioning.",
        });
      }

      // Verify signature
      console.log("🔍 Đang verify chữ ký...");
      const verify = crypto.createVerify("SHA256");
      verify.update(device.challenge);
      verify.end();

      let isValid = false;
      try {
        isValid = verify.verify(
          device.public_key,
          Buffer.from(signed_challenge, "base64")
        );
      } catch (verifyError) {
        console.error("✗ Lỗi verify signature:", verifyError.message);
        return this.publish(this.topics.DEVICE_FINALIZE_RESPONSE, {
          device_id,
          success: false,
          reason: "Invalid signature format or verification error",
        });
      }

      if (!isValid) {
        console.log("✗ Chữ ký không hợp lệ!");
        return this.publish(this.topics.DEVICE_FINALIZE_RESPONSE, {
          device_id,
          success: false,
          reason: "Invalid signature - challenge verification failed",
        });
      }

      console.log("✓ Chữ ký hợp lệ!");

      // Tạo certificate
      //   const certificate = this.generateCertificate(
      //     device_id,
      //     device.public_key
      //   );
      const result = await certificateService.issueDeviceCertificate(
        device_id,
        device.public_key
      );
      const certificate = result.certificate;

      // Cập nhật device
      device.certificate = certificate;
      device.status = "registered";
      device.challenge = null;
      device.challenge_created_at = null;
      device.provisioning_token = null;
      device.provisioning_token_expires = null;
      device.last_seen = new Date();
      await device.save();

      console.log("✓ Device đăng ký thành công:", device_id);

      // Gửi certificate về ESP32
      this.publish(this.topics.DEVICE_FINALIZE_RESPONSE, {
        device_id,
        success: true,
        certificate,
        message: "Device registered successfully. Certificate issued.",
      });

      // ✅ Gửi thông báo lên app qua Socket.IO
      if (global.io) {
        global.io.emit("device_registered", {
          device_id,
          status: "registered",
          timestamp: new Date(),
        });
      }

      // Log
      await AccessLog.create({
        access_method: "device_register",
        result: "success",
        device_id: device_id,
        additional_info: "Device provisioning completed successfully",
      });
    } catch (error) {
      console.error("✗ Lỗi finalize:", error);

      await AccessLog.create({
        access_method: "device_register",
        result: "failed",
        device_id: device_id,
        additional_info: `Finalize error: ${error.message}`,
      });

      this.publish(this.topics.DEVICE_FINALIZE_RESPONSE, {
        device_id,
        success: false,
        reason: "Server error: " + error.message,
      });
    }
  }

  // Helper: Tạo certificate
  generateCertificate(deviceId, publicKeyPem) {
    const certData = {
      subject: deviceId,
      issuer: "SmartLock_CA",
      validFrom: new Date().toISOString(),
      validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      publicKey: publicKeyPem,
    };

    const certString = JSON.stringify(certData);
    return `-----BEGIN CERTIFICATE-----
${Buffer.from(certString).toString("base64")}
-----END CERTIFICATE-----`;
  }

  // ✅ Handler gửi CA Certificate
  async handleRequestCACertificate(data) {
    console.log("📤 ESP32 yêu cầu CA Certificate...");
    const { device_id } = data;

    if (!device_id) {
      console.log("✗ Thiếu device_id");
      return;
    }

    try {
      const certificateService = require("../services/certificate.service");

      // Lấy CA certificate
      const caCertPem = certificateService.getCACertificate();

      // Gửi CA cert xuống ESP32
      const topic = `smartlock/device/${device_id}/ca_certificate`;
      this.publish(topic, {
        device_id,
        ca_certificate: caCertPem,
        timestamp: new Date().toISOString(),
      });

      console.log(`✓ Đã gửi CA Certificate cho device: ${device_id}`);
    } catch (error) {
      console.error("✗ Lỗi gửi CA Certificate:", error);
    }
  }

  // Thay thế hàm handleMessage trong mqtt.js
  handleMessage(topic, message) {
    try {
      const messageStr = message.toString();
      console.log(`\n📨 Nhận message từ topic: ${topic}`);
      console.log("Raw message:", messageStr);
<<<<<<< HEAD

      // ✅ XỬ LÝ REQUEST CA CERTIFICATE
      if (topic.includes("/request_ca_cert")) {
        try {
          const data = JSON.parse(messageStr);
          this.handleRequestCACertificate(data);
        } catch (parseError) {
          console.error("Lỗi parse request CA cert:", parseError);
        }
        return;
      }

=======
      // XỬ LÝ OTA PROGRESS – QUAN TRỌNG NHẤT!
      if (topic === this.topics.OTA_PROGRESS) {
        try {
          const OTAController = require("../controllers/otaController");
          const data = JSON.parse(messageStr);
          console.log("OTA PROGRESS:", data.percent + "% - " + data.message);
          OTAController.reportProgress(data); // GỌI CONTROLLER ĐỂ CẬP NHẬT DB + GỬI SOCKET.IO
        } catch (err) {
          console.error("Lỗi parse OTA progress:", err);
        }
        return;
      }
>>>>>>> origin/firmware-yen
      // Xử lý theo topic cụ thể
      switch (topic) {
        case this.topics.ENROLL_RFID:
          if (messageStr.startsWith("ENROLL_RFID:")) {
            // Message từ server gửi xuống ESP32 → BỎ QUA (không xử lý ở server)
            console.log("⏭️ Bỏ qua message điều khiển từ server xuống ESP32");
            return;
          } else {
            // Message từ ESP32 gửi lên → XỬ LÝ ENROLLMENT
            try {
              const data = JSON.parse(messageStr);
              console.log("🔄 Chế độ ENROLLMENT RFID - Nhận dữ liệu từ ESP32");
              console.log("Dữ liệu:", data);
              this.handleEnrollRFID(data);
            } catch (parseError) {
              console.error("Lỗi parse JSON từ ESP32:", parseError);
            }
          }
          break;
        case this.topics.ENROLL_FINGERPRINT_RESULT:
          try {
            const data = JSON.parse(messageStr);
            this.handleEnrollFingerprintResult(data);
          } catch (parseError) {
            console.error("Lỗi parse JSON fingerprint result:", parseError);
          }
          break;
        case this.topics.FINGERPRINT:
          const fingerprintData = JSON.parse(messageStr);
          this.handleFingerprint(fingerprintData);
          break;

        case this.topics.RFID:
          const rfidData = JSON.parse(messageStr);
          this.handleRFID(rfidData);
          break;

        case this.topics.CHECK_RFID:
          const checkData = JSON.parse(messageStr);
          this.handleCheckRFID(checkData);
          break;

        case this.topics.FACE:
          const faceData = JSON.parse(messageStr);
          this.handleFace(faceData);
          break;

        case this.topics.FACE_UNLOCK: // ✅ THÊM handler riêng
          try {
            const data = JSON.parse(messageStr);
            this.handleFace(data);
          } catch (parseError) {
            console.error("Lỗi parse face unlock:", parseError);
          }
          break;

        case this.topics.STATUS:
          const statusData = JSON.parse(messageStr);
          this.handleStatus(statusData);
          break;

        case this.topics.ENROLL_SUCCESS:
          const successData = JSON.parse(messageStr);
          this.handleEnrollSuccess(successData);
          break;

        case this.topics.ENROLL_FAILED:
          const failedData = JSON.parse(messageStr);
          this.handleEnrollFailed(failedData);
          break;
        case this.topics.DELETE_FINGERPRINT_RESULT:
          try {
            const data = JSON.parse(messageStr);
            this.handleDeleteFingerprintResult(data);
          } catch (parseError) {
            console.error(
              "Lỗi parse JSON delete fingerprint result:",
              parseError
            );
          }
          break;
        case this.topics.DEVICE_PROVISION_REQUEST:
          try {
            const data = JSON.parse(messageStr);
            this.handleDeviceProvisionRequest(data);
          } catch (parseError) {
            console.error("Lỗi parse provision request:", parseError);
          }
          break;

        case this.topics.DEVICE_FINALIZE_REQUEST:
          try {
            const data = JSON.parse(messageStr);
            this.handleDeviceFinalizeRequest(data);
          } catch (parseError) {
            console.error("Lỗi parse finalize request:", parseError);
          }
          break;
        case this.topics.DEVICE_LOGIN:
          try {
            const loginData = JSON.parse(messageStr);
            this.handleDeviceLogin(loginData);
          } catch (parseError) {
            console.error("Lỗi parse login request:", parseError);
          }
          break;

        case this.topics.DEVICE_HEARTBEAT:
          try {
            const heartbeatData = JSON.parse(messageStr);
            this.handleDeviceHeartbeat(heartbeatData);
          } catch (parseError) {
            console.error("Lỗi parse heartbeat:", parseError);
          }
          break;
        default:
          console.log("Topic không xác định");
      }
    } catch (error) {
      console.error("Lỗi xử lý message:", error);
      console.error("Topic:", topic);
      console.error("Message:", message.toString());
    }
  }

  // Xử lý enrollment thành công
  async handleEnrollSuccess(data) {
    console.log("✓ Đăng ký vân tay thành công!");
    console.log("Dữ liệu:", data);

    try {
      const Fingerprint = require("../models/fingerprint.model");
      const { fingerprintId, user_id, finger_position, hand } = data;

      // Lưu vào database
      const fingerprint = await Fingerprint.create({
        fingerprint_id: String(fingerprintId),
        user_id,
        finger_position: finger_position || "unknown",
        hand: hand || "unknown",
        template_base64: "", // ESP32 không gửi template
        registered_at: new Date(),
      });

      console.log(`✓ Đã lưu vân tay ID ${fingerprintId} vào database`);

      // Gửi WebSocket notification cho app (nếu có)
      if (global.io) {
        global.io.emit("fingerprint_enrolled", {
          success: true,
          fingerprintId: fingerprint.fingerprint_id,
          user_id: fingerprint.user_id,
          finger_position: fingerprint.finger_position,
          hand: fingerprint.hand,
        });
      }
    } catch (error) {
      console.error("Lỗi lưu fingerprint:", error);
    }
  }

  // Xử lý enrollment thất bại
  handleEnrollFailed(data) {
    console.log("✗ Đăng ký vân tay thất bại");
    console.log("Lý do:", data.reason || "Unknown error");

    // Gửi WebSocket notification
    if (global.io) {
      global.io.emit("fingerprint_enrolled", {
        success: false,
        reason: data.reason || "Enrollment failed",
      });
    }
  }

  // Xử lý trạng thái thiết bị
  handleStatus(data) {
    console.log("Cập nhật trạng thái thiết bị:", data);
  }

  // Gửi lệnh mở khóa
  unlockDoor(method, data) {
    const command = {
      action: "unlock",
      method: method,
      timestamp: new Date().toISOString(),
      data: data,
    };

    this.publish(this.topics.UNLOCK, command);
    console.log("Đã gửi lệnh mở khóa");
  }

  // Gửi lệnh khóa cửa
  lockDoor() {
    const command = {
      action: "lock",
      timestamp: new Date().toISOString(),
    };

    this.publish(this.topics.LOCK, command);
    console.log("Đã gửi lệnh khóa cửa");
  }

  // Publish message lên MQTT
  publish(topic, payload, options = { qos: 1 }) {
    if (!this.isConnected) {
      console.error("Chưa kết nối tới MQTT Broker");
      return;
    }

    const message =
      typeof payload === "string" ? payload : JSON.stringify(payload);

    this.client.publish(topic, message, options, (err) => {
      if (err) {
        console.error("Lỗi publish message:", err);
      } else {
        console.log(`✓ Đã publish lên topic: ${topic}`);
      }
    });
  }

  // Ngắt kết nối
  disconnect() {
    if (this.client) {
      this.client.end();
      console.log("Đã ngắt kết nối MQTT");
    }
  }
}

// Export singleton instance
const mqttService = new MQTTService();

module.exports = mqttService;

const mqtt = require("mqtt");

class MQTTService {
  constructor() {
    this.client = null;
    this.isConnected = false;

    // Thay đổi thông tin này theo MQTT Broker của bạn
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
      FACE: "smartlock/sensor/face",
      STATUS: "smartlock/status",
      CONTROL: "smartlock/control",
      UNLOCK: "smartlock/control/unlock",
      LOCK: "smartlock/control/lock",
    };
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
      this.topics.FACE,
      this.topics.STATUS,
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

  // Xử lý message nhận được
  handleMessage(topic, message) {
    try {
      const data = JSON.parse(message.toString());
      console.log(`\n📨 Nhận message từ topic: ${topic}`);
      console.log("Dữ liệu:", data);

      // Xử lý theo từng loại cảm biến
      switch (topic) {
        case this.topics.FINGERPRINT:
          this.handleFingerprint(data);
          break;
        case this.topics.RFID:
          this.handleRFID(data);
          break;
        case this.topics.FACE:
          this.handleFace(data);
          break;
        case this.topics.STATUS:
          this.handleStatus(data);
          break;
        default:
          console.log("Topic không xác định");
      }
    } catch (error) {
      console.error("Lỗi xử lý message:", error);
    }
  }

  // Xử lý dữ liệu vân tay
  handleFingerprint(data) {
    console.log("🔐 Xử lý xác thực vân tay...");
    const isValid = true;

    if (isValid) {
      console.log("✓ Vân tay hợp lệ - Mở khóa");
      this.unlockDoor("fingerprint", data);
    } else {
      console.log("✗ Vân tay không hợp lệ");
      this.publish(this.topics.CONTROL, {
        action: "deny",
        reason: "invalid_fingerprint",
      });
    }
  }

  // Xử lý dữ liệu RFID
  handleRFID(data) {
    console.log("💳 Xử lý xác thực RFID...");
    const isValid = true;

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
  }

  // Xử lý dữ liệu nhận diện khuôn mặt
  handleFace(data) {
    console.log("👤 Xử lý nhận diện khuôn mặt...");
    const isValid = true;

    if (isValid) {
      console.log("✓ Khuôn mặt hợp lệ - Mở khóa");
      this.unlockDoor("face", data);
    } else {
      console.log("✗ Khuôn mặt không hợp lệ");
      this.publish(this.topics.CONTROL, {
        action: "deny",
        reason: "invalid_face",
      });
    }
  }

  // Xử lý trạng thái thiết bị
  handleStatus(data) {
    console.log("📊 Cập nhật trạng thái thiết bị:", data);
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
    console.log("📤 Đã gửi lệnh mở khóa");
  }

  // Gửi lệnh khóa cửa
  lockDoor() {
    const command = {
      action: "lock",
      timestamp: new Date().toISOString(),
    };

    this.publish(this.topics.LOCK, command);
    console.log("📤 Đã gửi lệnh khóa cửa");
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

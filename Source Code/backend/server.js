require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const morgan = require("morgan");

const database = require("./config/database");
const mqttClient = require("./config/mqtt");
const route = require("./routes/index.route");
const certificateService = require("./services/certificate.service");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    methods: ["GET", "POST"],
  },
});
global.io = io;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    credentials: true,
  })
);
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: false }));

// Health check
app.get("/health", (req, res) =>
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    mqtt: mqttClient.isConnected,
  })
);

route(app);

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("authenticate", (data) => {
    // Join user room
    if (data.userId) {
      socket.join(`user_${data.userId}`);
      console.log(`Socket ${socket.id} joined user_${data.userId}`);
    }

    // Join organization room (for user_manager)
    if (data.orgId) {
      socket.join(`org_${data.orgId}`);
      console.log(`Socket ${socket.id} joined org_${data.orgId}`);
    }

    // Join role room (for admin)
    if (data.role) {
      socket.join(`role_${data.role}`);
      console.log(`Socket ${socket.id} joined role_${data.role}`);
    }
  });

  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

// MQTT subscription logic
function setupMqttSubscriptions() {
  mqttClient.subscribe("smartlock/+/auth", async (topic, payload) => {
    console.log("Received auth request:", payload);
  });
  mqttClient.subscribe("smartlock/+/status", async (topic, payload) => {
    const deviceId = topic.split("/")[1];
    io.emit("device_status", { deviceId, ...payload });
  });
}

// Start server
const PORT = process.env.PORT || 5000;
const startServer = async () => {
  try {
    // 1. Khởi tạo CA trước
    await certificateService.initializeCA();

    // 2. Kết nối MongoDB
    await database.connect();

    // Kết nối MQTT với callback
    mqttClient.connect(() => {
      // Chỉ setup subscriptions sau khi MQTT đã kết nối
      setupMqttSubscriptions();
    });

    server.listen(PORT, () => {
      console.log(
        `Server running on port ${PORT} | Env: ${
          process.env.NODE_ENV || "development"
        }`
      );
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

// Graceful shutdown
["SIGINT", "SIGTERM"].forEach((signal) =>
  process.on(signal, () => {
    console.log(`${signal} received: closing server`);
    server.close(() => {
      mqttClient.disconnect();
      process.exit(0);
    });
  })
);

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason, promise);
  process.exit(1);
});

startServer();

module.exports = { app, server, io };

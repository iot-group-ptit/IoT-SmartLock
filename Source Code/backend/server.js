require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const database = require("./config/database");
const mqttClient = require("./config/mqtt");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimiter");

// Routes
const routes = {
  auth: require("./routes/authRoutes"),
  users: require("./routes/userRoutes"),
  access: require("./routes/accessRoutes"),
  biometric: require("./routes/biometricRoutes"),
  logs: require("./routes/logRoutes"),
  notifications: require("./routes/notificationRoutes"),
  organizations: require("./routes/organizationRoutes"),
  devices: require("./routes/deviceRoutes"),
  sensors: require("./routes/sensorRoutes"),
  control: require("./routes/commandRoutes"),
};

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
app.use("/api/", apiLimiter);

// Health check
app.get("/health", (req, res) =>
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    mqtt: mqttClient.isConnected,
  })
);

// Register routes
Object.entries(routes).forEach(([key, route]) => app.use(`/api/${key}`, route));

// 404 + error handler
app.use(notFound);
app.use(errorHandler);

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("authenticate", (data) => {
    if (data.userId) socket.join(`user_${data.userId}`);
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
const PORT = process.env.PORT || 3000;
const startServer = async () => {
  try {
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

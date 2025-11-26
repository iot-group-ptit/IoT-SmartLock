# IoT SmartLock Backend - MongoDB Version

## 🎯 Tổng quan

Backend API cho hệ thống IoT Smart Lock sử dụng **MongoDB** làm database, hỗ trợ:
- ✅ RESTful API với Express.js
- ✅ MongoDB với Mongoose ODM
- ✅ Real-time communication (Socket.IO)
- ✅ MQTT cho IoT devices
- ✅ Face recognition AI
- ✅ Biometric authentication (RFID, fingerprint, face)
- ✅ Multi-tenant organization support

## 📋 Yêu cầu hệ thống

- Node.js >= 14.0
- MongoDB >= 4.4 (local hoặc MongoDB Atlas)
- npm hoặc yarn

## 🚀 Cài đặt

### 1. Clone repository
```bash
git clone <repo-url>
cd backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup MongoDB

**Option A: Local MongoDB**
```bash
# Install MongoDB Community Edition
# Windows: https://www.mongodb.com/try/download/community
# Mac: brew install mongodb-community
# Linux: sudo apt-get install mongodb

# Start MongoDB
mongod --dbpath C:\data\db
```

**Option B: MongoDB Atlas (Cloud)**
1. Tạo account tại https://cloud.mongodb.com
2. Tạo cluster mới
3. Lấy connection string

### 4. Environment Configuration

Tạo file `.env`:
```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/smartlock_db
# Or MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smartlock_db

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRE=24h
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRE=7d

# MQTT
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=

# Face Recognition
FACE_RECOGNITION_THRESHOLD=0.6

# File Upload
MAX_FILE_SIZE=5242880

# Security
BCRYPT_SALT_ROUNDS=10
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4200
```

### 5. Seed Database

```bash
node scripts/seedMongoDB.js
```

### 6. Start Server

```bash
# Development
npm run dev

# Production
npm start
```

## 📊 Database Schema

### Collections (11 collections)

1. **organizations** - Tổ chức/công ty
2. **users** - Người dùng hệ thống
3. **devices** - Thiết bị IoT (ESP32)
4. **rfidcards** - Thẻ RFID
5. **biometricdata** - Dữ liệu sinh trắc học (fingerprint, face)
6. **accesslogs** - Lịch sử truy cập
7. **sensors** - Cảm biến (temperature, humidity, etc.)
8. **telemetries** - Dữ liệu telemetry từ sensors
9. **commands** - Lệnh điều khiển gửi đến devices
10. **firmwareupdates** - Cập nhật firmware OTA
11. **notifications** - Thông báo người dùng

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/register       - Đăng ký user mới
POST   /api/auth/login          - Login (sau biometric verification)
GET    /api/auth/profile        - Lấy profile
PUT    /api/auth/profile        - Update profile
POST   /api/auth/refresh-token  - Refresh JWT token
```

### Users
```
GET    /api/users               - Danh sách users (admin)
GET    /api/users/:id           - Chi tiết user
POST   /api/users               - Tạo user (admin)
PUT    /api/users/:id           - Update user (admin)
DELETE /api/users/:id           - Xóa user (admin)
```

### Organizations
```
GET    /api/organizations       - Danh sách organizations (admin)
GET    /api/organizations/:id   - Chi tiết organization
POST   /api/organizations       - Tạo organization (admin)
PUT    /api/organizations/:id   - Update organization (admin)
DELETE /api/organizations/:id   - Xóa organization (admin)
```

### Devices
```
GET    /api/devices             - Danh sách devices
GET    /api/devices/:id         - Chi tiết device
POST   /api/devices             - Tạo device
PUT    /api/devices/:id         - Update device
DELETE /api/devices/:id         - Xóa device
GET    /api/devices/:id/stats   - Thống kê device
```

### Biometric
```
POST   /api/biometric/rfid      - Thêm RFID card
GET    /api/biometric/rfid/:userId  - RFID cards của user
PUT    /api/biometric/rfid/:cardId  - Update RFID card
DELETE /api/biometric/rfid/:cardId  - Xóa RFID card
POST   /api/biometric/data      - Thêm biometric data
GET    /api/biometric/fingerprints/:userId - Fingerprints của user
```

### Face Recognition
```
POST   /api/face/register       - Đăng ký khuôn mặt
POST   /api/face/authenticate   - Xác thực khuôn mặt
GET    /api/face/user/:userId   - Face data của user
DELETE /api/face/:bioId         - Xóa face data
```

### Access Control
```
POST   /api/access/rfid         - Xác thực RFID
POST   /api/access/fingerprint  - Xác thực fingerprint
```

### Logs
```
GET    /api/logs                - Danh sách access logs
GET    /api/logs/user/:userId   - Logs theo user
GET    /api/logs/device/:deviceId - Logs theo device
GET    /api/logs/stats          - Thống kê truy cập
```

### Sensors & Telemetry
```
GET    /api/sensors             - Danh sách sensors
POST   /api/sensors             - Tạo sensor
GET    /api/sensors/:id         - Chi tiết sensor
POST   /api/sensors/telemetry   - Post telemetry data (từ device)
GET    /api/sensors/:id/telemetry - Lấy telemetry data
```

### Commands & Firmware
```
GET    /api/control/commands    - Danh sách commands
POST   /api/control/commands    - Gửi command đến device
PATCH  /api/control/commands/:id/status - Update command status
GET    /api/control/firmware    - Danh sách firmware updates
POST   /api/control/firmware    - Khởi tạo firmware update
PATCH  /api/control/firmware/:id/status - Update firmware status
```

### Notifications
```
GET    /api/notifications       - Danh sách notifications của user
PATCH  /api/notifications/:id/read - Đánh dấu đã đọc
PATCH  /api/notifications/read-all - Đánh dấu tất cả đã đọc
DELETE /api/notifications/:id   - Xóa notification
```

## 🔐 Authentication Flow

1. **User Registration** - Tạo account không có password
2. **Biometric Registration** - Đăng ký RFID/fingerprint/face
3. **Physical Access** - Xác thực bằng biometric tại device
4. **API Login** - Sau khi biometric verified, login để lấy JWT token
5. **API Access** - Sử dụng JWT token cho các API calls

## 📡 Real-time Features

### Socket.IO Events

**Client → Server:**
```javascript
socket.emit('authenticate', { userId: 'USER001' });
```

**Server → Client:**
```javascript
// Access alerts
socket.on('access_alert', (data) => {
  // { type, result, device_id, timestamp }
});

// Device status updates
socket.on('device_status', (data) => {
  // { deviceId, status, ... }
});
```

### MQTT Topics

**Device → Server:**
```
smartlock/{device_id}/auth     - Authentication requests
smartlock/{device_id}/status   - Status updates
smartlock/{device_id}/telemetry - Telemetry data
```

**Server → Device:**
```
smartlock/{device_id}/command  - Control commands
smartlock/{device_id}/ota      - Firmware updates
```

## 🧪 Testing

### Health Check
```bash
curl http://localhost:3000/health
```

### Test với Postman/Insomnia

1. Import collection (nếu có)
2. Set environment variable `BASE_URL=http://localhost:3000`
3. Test endpoints theo thứ tự:
   - Register user
   - Login
   - Get profile
   - Create device
   - Add biometric data

## 📁 Project Structure

```
backend/
├── config/
│   ├── database.js          # MongoDB connection
│   └── mqtt.js             # MQTT client config
├── models/                 # Mongoose schemas (11 models)
│   ├── Organization.js
│   ├── User.js
│   ├── Device.js
│   ├── RFIDCard.js
│   ├── BiometricData.js
│   ├── AccessLog.js
│   ├── Sensor.js
│   ├── Telemetry.js
│   ├── Command.js
│   ├── FirmwareUpdate.js
│   └── Notification.js
├── controllers/           # Business logic (11 controllers)
│   ├── authController.js
│   ├── userController.js
│   ├── organizationController.js
│   ├── deviceController.js
│   ├── biometricController.js
│   ├── faceController.js
│   ├── accessController.js
│   ├── logController.js
│   ├── sensorController.js
│   ├── commandController.js
│   └── notificationController.js
├── routes/               # API routes (11 route files)
│   ├── authRoutes.js
│   ├── userRoutes.js
│   ├── organizationRoutes.js
│   ├── deviceRoutes.js
│   ├── biometricRoutes.js
│   ├── faceRoutes.js
│   ├── accessRoutes.js
│   ├── logRoutes.js
│   ├── sensorRoutes.js
│   ├── commandRoutes.js
│   └── notificationRoutes.js
├── middleware/           # Custom middleware
│   ├── auth.js          # JWT authentication
│   ├── errorHandler.js  # Error handling
│   ├── validation.js    # Input validation
│   └── rateLimiter.js   # Rate limiting
├── scripts/
│   └── seedMongoDB.js   # Database seeding
├── uploads/             # Uploaded files (face images)
├── face-models/         # Face recognition AI models
├── server.js            # Entry point
├── .env                 # Environment variables
└── package.json
```

## ⚙️ Configuration

### MongoDB Indexes

Tự động tạo indexes khi start app. Kiểm tra:
```bash
mongo
> use smartlock_db
> db.users.getIndexes()
```

### Rate Limiting

- Window: 15 phút
- Max requests: 100 requests/window
- Áp dụng cho tất cả `/api/*` routes

### CORS

Configure allowed origins trong `.env`:
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4200
```

## 🔧 Troubleshooting

### MongoDB Connection Error
```bash
# Windows: Check MongoDB service
mongod --version
net start MongoDB

# Check connection string
echo $MONGODB_URI

# Test connection
mongo
> show dbs
```

### Port Already in Use (Windows)
```powershell
# Find process using port 3000
Get-NetTCPConnection -LocalPort 3000
netstat -ano | findstr :3000

# Kill process
taskkill /PID <PID> /F
```

### Face Recognition Models Missing
```bash
# Download models từ face-api.js
mkdir face-models
cd face-models
# Models cần: ssd_mobilenetv1, face_landmark_68, face_recognition
# Download từ: https://github.com/justadudewhohacks/face-api.js-models
```

### Verify Migration Status
```bash
# Check Mongoose imports
grep -r "require.*models" controllers/ | wc -l
# Kết quả mong đợi: 11+ lines
```

## 📚 Documentation

- [MongoDB Migration Guide](./MONGODB_MIGRATION_GUIDE.md) - ✅ Migration đã hoàn tất
- [Mongoose Models](./models/) - 11 Mongoose schemas
- [Controllers](./controllers/) - 11 MongoDB controllers
- [Routes](./routes/) - API route definitions

## 🎉 Migration Completion Status

✅ **Models**: 11/11 completed  
✅ **Controllers**: 11/11 completed  
✅ **Routes**: 11/11 verified  
✅ **Database Connection**: MongoDB configured  
✅ **Dependencies**: Mongoose installed, mysql2 removed  

**Kết quả:** Backend đã sẵn sàng sử dụng với MongoDB!

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

MIT License

## 👥 Team

PTIT IoT Team - Smart Lock Project 2025

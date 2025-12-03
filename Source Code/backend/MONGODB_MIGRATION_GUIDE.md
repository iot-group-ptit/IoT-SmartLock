# MongoDB Migration Guide

## ✅ Đã hoàn thành 100%

### 1. Package.json
- ✅ Đã thay `mysql2` bằng `mongoose`

### 2. Database Connection
- ✅ File `config/database.js` đã chuyển sang MongoDB connection

### 3. Mongoose Models (11 models)
- ✅ `models/Organization.js`
- ✅ `models/User.js`
- ✅ `models/Device.js`
- ✅ `models/RFIDCard.js`
- ✅ `models/BiometricData.js`
- ✅ `models/AccessLog.js`
- ✅ `models/Sensor.js`
- ✅ `models/Telemetry.js`
- ✅ `models/Command.js`
- ✅ `models/FirmwareUpdate.js`
- ✅ `models/Notification.js`

### 4. Environment Configuration
- ✅ File `.env.example` với MONGODB_URI

### 5. Controllers (11 files - ✅ ĐÃ HOÀN THÀNH)
- ✅ `authController.js`
- ✅ `userController.js`
- ✅ `organizationController.js`
- ✅ `deviceController.js`
- ✅ `biometricController.js`
- ✅ `faceController.js`
- ✅ `accessController.js`
- ✅ `logController.js`
- ✅ `sensorController.js`
- ✅ `commandController.js`
- ✅ `notificationController.js`

### 6. Routes
- ✅ Tất cả routes đã được kiểm tra và cập nhật

## 📚 Pattern chuyển đổi đã áp dụng

#### Pattern chuyển đổi:

**TỪ MySQL:**
```javascript
const { promisePool } = require('../config/database');

const [result] = await promisePool.query(
  'SELECT * FROM User WHERE user_id = ?',
  [user_id]
);
```

**SANG MongoDB:**
```javascript
const User = require('../models/User');

const user = await User.findOne({ user_id });
```

### Các thao tác thường dùng:

#### 1. SELECT / Find
**MySQL:**
```javascript
const [users] = await promisePool.query('SELECT * FROM User WHERE role = ?', ['admin']);
```

**MongoDB:**
```javascript
const users = await User.find({ role: 'admin' });
```

#### 2. INSERT / Create
**MySQL:**
```javascript
const [result] = await promisePool.query(
  'INSERT INTO User (user_id, email, full_name) VALUES (?, ?, ?)',
  [user_id, email, full_name]
);
```

**MongoDB:**
```javascript
const user = await User.create({ user_id, email, full_name });
```

#### 3. UPDATE
**MySQL:**
```javascript
await promisePool.query(
  'UPDATE User SET email = ? WHERE user_id = ?',
  [email, user_id]
);
```

**MongoDB:**
```javascript
await User.findOneAndUpdate(
  { user_id },
  { email },
  { new: true }
);
```

#### 4. DELETE
**MySQL:**
```javascript
await promisePool.query('DELETE FROM User WHERE user_id = ?', [user_id]);
```

**MongoDB:**
```javascript
await User.findOneAndDelete({ user_id });
```

#### 5. JOIN / Populate
**MySQL:**
```javascript
const [result] = await promisePool.query(`
  SELECT u.*, o.name as org_name
  FROM User u
  LEFT JOIN Organization o ON u.org_id = o.org_id
  WHERE u.user_id = ?
`, [user_id]);
```

**MongoDB:**
```javascript
const user = await User.findOne({ user_id })
  .populate('org_id', 'name');
```

#### 6. COUNT / Aggregate
**MySQL:**
```javascript
const [[{ count }]] = await promisePool.query(
  'SELECT COUNT(*) as count FROM User WHERE role = ?',
  ['user']
);
```

**MongoDB:**
```javascript
const count = await User.countDocuments({ role: 'user' });
```

## ✅ Controllers đã chuyển đổi thành công

Tất cả 11 controllers đã được chuyển đổi hoàn toàn từ MySQL sang MongoDB:

### 1. authController.js ✅
- register: `User.create()`
- login: `User.findOne({ user_id })`
- getProfile: `User.findOne()`
- updateProfile: `User.findOneAndUpdate()`

### 2. userController.js ✅
- getAllUsers: `User.find()` + pagination
- getUserById: `User.findOne({ user_id })`
- createUser: `User.create()`
- updateUser: `User.findOneAndUpdate()`
- deleteUser: `User.findOneAndDelete()`
- toggleUserStatus: `User.findOneAndUpdate()`

### 3. organizationController.js ✅
- getAllOrganizations: `Organization.find()`
- getOrganizationById: `Organization.findOne({ org_id })`
- createOrganization: `Organization.create()`
- updateOrganization: `Organization.findOneAndUpdate()`
- deleteOrganization: `Organization.findOneAndDelete()`
- Stats: `User.countDocuments()` + `Device.countDocuments()`

### 4. deviceController.js ✅
- getAllDevices: `Device.find()` + filters
- getDeviceById: `Device.findOne({ device_id })`
- createDevice: `Device.create()`
- updateDevice: `Device.findOneAndUpdate()`
- deleteDevice: `Device.findOneAndDelete()`
- getDeviceStatistics: `AccessLog.aggregate()` pipelines

### 5. biometricController.js ✅
- addRFIDCard: `RFIDCard.create()`
- getUserRFIDCards: `RFIDCard.find({ user_id })`
- updateRFIDCard: `RFIDCard.findOneAndUpdate({ card_id })`
- deleteRFIDCard: `RFIDCard.findOneAndDelete({ card_id })`
- addBiometricData: `BiometricData.create()`
- getUserFingerprints: `BiometricData.find()`
- updateFingerprint: `BiometricData.findOneAndUpdate({ bio_id })`
- deleteFingerprint: `BiometricData.findOneAndDelete({ bio_id })`

### 6. faceController.js ✅
- registerFace: `BiometricData.create()` với face-api.js
- authenticateFace: `BiometricData.find().populate('user_id')`
- getUserFaceData: `BiometricData.find({ biometric_type: 'face' })`
- deleteFaceData: `BiometricData.findOneAndDelete()`

### 7. accessController.js ✅
- authenticateRFID: `RFIDCard.findOne().populate()` + `AccessLog.create()`
- authenticateFingerprint: `BiometricData.findOne().populate()` + `AccessLog.create()`
- remoteUnlock: `Device.findOne()` + MQTT
- getDoorStatus: `Device.findOne()`

### 8. logController.js ✅
- getAccessLogs: `AccessLog.find()` với date filters
- getAccessStatistics: Complex aggregation pipelines:
  - byMethod: `$group` by access_method
  - byResult: `$group` by result
  - dailyAccess: `$dateToString` + `$group`
  - topUsers: `$lookup` + `$group` + `$sort`
- getUserAccessHistory: `AccessLog.find({ user_id })`
- exportAccessLogs: CSV export với `.populate()`

### 9. sensorController.js ✅
- getAllSensors: `Sensor.find()` với filters
- getSensorById: `Sensor.findOne()` + `Telemetry.find()`
- createSensor: `Sensor.create()` với duplicate check
- updateSensor: `Sensor.findOneAndUpdate()` dynamic fields
- deleteSensor: `Sensor.findOneAndDelete()`
- getTelemetryData: `Telemetry.find()` với pagination + date range
- createTelemetry: `Telemetry.create()`

### 10. commandController.js ✅
- getAllCommands: `Command.find()` + pagination
- getCommandById: `Command.findOne({ command_id })`
- sendCommand: `Command.create()` + MQTT publish
- updateCommandStatus: `Command.findOneAndUpdate()`
- getFirmwareUpdates: `FirmwareUpdate.find()`
- initiateFirmwareUpdate: `FirmwareUpdate.create()` + MQTT
- updateFirmwareStatus: `FirmwareUpdate.findOneAndUpdate()` + Device update

### 11. notificationController.js ✅
- getUserNotifications: `Notification.find()` + pagination
- markAsRead: `Notification.findOneAndUpdate()`
- markAllAsRead: `Notification.updateMany()`
- deleteNotification: `Notification.findOneAndDelete()`
- createNotification: `Notification.create()` + Socket.IO emit

## 🔧 Server.js Updates

Update file `server.js`:

```javascript
// Old
const { initDatabase } = require('./config/database');
initDatabase();

// New
const connectDB = require('./config/database');
connectDB();
```

## 📦 Installation Steps

1. **Install dependencies:**
```bash
npm uninstall mysql2
npm install mongoose
```

2. **Setup MongoDB:**
```bash
# Local MongoDB
mongod --dbpath C:\data\db

# Or use MongoDB Atlas (cloud)
# Get connection string from https://cloud.mongodb.com
```

3. **Update .env:**
```env
MONGODB_URI=mongodb://localhost:27017/smartlock_db
# Or for Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smartlock_db
```

4. **Run seed script:**
```bash
node scripts/seedMongoDB.js
```

## 🎯 Testing

```bash
# Start server
npm run dev

# Test endpoints
POST http://localhost:3000/api/auth/register
POST http://localhost:3000/api/auth/login
GET http://localhost:3000/api/users
```

## ⚠️ Important Notes

1. **ObjectId vs String ID:**
   - Giữ nguyên string IDs (user_id, device_id...) như schema cũ
   - MongoDB tự tạo `_id` ObjectId, nhưng ta dùng custom IDs

2. **Transactions:**
   - MongoDB hỗ trợ transactions (replica set)
   - Cần thiết cho operations phức tạp

3. **Indexes:**
   - Đã define trong schemas
   - MongoDB tự tạo index khi khởi động

4. **Foreign Keys:**
   - Không có ràng buộc như MySQL
   - Dùng `ref` trong schema và `.populate()` khi query

5. **Views:**
   - MySQL views không có trong Mongo
   - Dùng Aggregation Pipeline thay thế

## 🚀 Sẵn sàng sử dụng

Migration đã hoàn tất 100%! Để chạy backend:

```bash
# 1. Start MongoDB
mongod

# 2. Seed database (nếu chưa có data)
node scripts/seedMongoDB.js

# 3. Start backend server
npm run dev

# 4. Test API endpoints
# Server chạy tại: http://localhost:3000
```

### Kiểm tra Migration

```bash
# Verify không còn MySQL dependencies
grep -r "promisePool" controllers/
# Kết quả: No matches found ✅

# Verify tất cả imports Mongoose models
grep -r "require.*models" controllers/
# Kết quả: Tất cả controllers import Mongoose models ✅
```

---


require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Device = require('../models/Device');
const RFIDCard = require('../models/RFIDCard');
const Face = require('../models/Face');
const Fingerprint = require('../models/Fingerprint');
const Sensor = require('../models/Sensor');
const Telemetry = require('../models/Telemetry');
const AccessLog = require('../models/AccessLog');

const seedDatabase = async () => {
  try {
    console.log('Starting MongoDB seeding...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB - smartlock_db');

    // Clear existing data
    await Organization.deleteMany({});
    await User.deleteMany({});
    await Device.deleteMany({});
    await RFIDCard.deleteMany({});
    await Face.deleteMany({});
    await Fingerprint.deleteMany({});
    await Sensor.deleteMany({});
    await Telemetry.deleteMany({});
    await AccessLog.deleteMany({});
    console.log('Cleared existing data');

    // Create organization
    const org = await Organization.create({
      org_id: 'ORG001',
      name: 'PTIT Smart Building',
      created_at: new Date(),
      address: 'Ha Noi, Vietnam'
    });
    console.log('Organization created');

    // Hash passwords
    const hashedAdminPwd = await bcrypt.hash('admin123', 10);
    const hashedManagerPwd = await bcrypt.hash('manager123', 10);
    const hashedUserPwd = await bcrypt.hash('user123', 10);

    // Create users (using insertMany with pre-hashed passwords)
    const users = await User.insertMany([
      {
        user_id: 'USER001',
        email: 'admin@ptit.edu.vn',
        password: hashedAdminPwd,
        full_name: 'System Administrator',
        phone: '0123456789',
        role: 'admin',
        org_id: org.org_id
      },
      {
        user_id: 'USER002',
        email: 'manager@ptit.edu.vn',
        password: hashedManagerPwd,
        full_name: 'User Manager',
        phone: '0987654321',
        role: 'user_manager',
        org_id: org.org_id
      },
      {
        user_id: 'USER003',
        email: 'user1@ptit.edu.vn',
        password: hashedUserPwd,
        full_name: 'Nguyen Van A',
        phone: '0123111111',
        role: 'user',
        org_id: org.org_id
      },
      {
        user_id: 'USER004',
        email: 'user2@ptit.edu.vn',
        password: hashedUserPwd,
        full_name: 'Tran Thi B',
        phone: '0123222222',
        role: 'user',
        org_id: org.org_id
      }
    ]);
    console.log('Users created');

    // Create devices
    const devices = await Device.insertMany([
      {
        device_id: 'DEV001',
        type: 'smartlock',
        model: 'ESP32-WROOM-32',
        status: 'online',
        fw_current: 'v1.0.0',
        org_id: org.org_id
      },
      {
        device_id: 'DEV002',
        type: 'smartlock',
        model: 'ESP32-WROOM-32',
        status: 'offline',
        fw_current: 'v1.0.0',
        org_id: org.org_id
      }
    ]);
    console.log('Devices created');

    // Create RFID cards (UID format from ESP32, user_id as ObjectId)
    await RFIDCard.insertMany([
      {
        card_id: 'CARD001',
        uid: 'ad7dce01', // UID from ESP32 in hex format
        issued_at: new Date('2025-01-01'),
        expired_at: new Date('2026-01-01'),
        user_id: users[2]._id // USER003 (Nguyen Van A)
      },
      {
        card_id: 'CARD002',
        uid: 'b3bbe156', // Second card UID
        issued_at: new Date('2025-01-01'),
        expired_at: new Date('2026-01-01'),
        user_id: users[3]._id // USER004 (Tran Thi B)
      },
      {
        card_id: 'CARD003',
        uid: '1a2b3c4d', // Test card (expired)
        issued_at: new Date('2024-01-01'),
        expired_at: new Date('2024-12-31'),
        user_id: users[2]._id // USER003
      }
    ]);
    console.log('RFID cards created');

    // Create face data (face_id as number from ESP32)
    await Face.insertMany([
      {
        face_id: 'FACE001',
        user_id: 'USER003',
        image_base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // Sample 1x1 pixel image
        registered_at: new Date('2025-01-01')
      },
      {
        face_id: 'FACE002',
        user_id: 'USER004',
        image_base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        registered_at: new Date('2025-01-02')
      }
    ]);
    console.log('Face data created');

    // Create fingerprint data (fingerprint_id as number from ESP32)
    await Fingerprint.insertMany([
      {
        fingerprint_id: '1', // ID 1 in ESP32 sensor
        user_id: 'USER003',
        template_base64: 'RlBJUjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=', // Sample fingerprint template
        finger_position: 'index',
        hand: 'right',
        registered_at: new Date('2025-01-01')
      },
      {
        fingerprint_id: '2', // ID 2 in ESP32 sensor
        user_id: 'USER004',
        template_base64: 'RlBJUjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=',
        finger_position: 'thumb',
        hand: 'right',
        registered_at: new Date('2025-01-02')
      },
      {
        fingerprint_id: '3', // ID 3 in ESP32 sensor
        user_id: 'USER003',
        template_base64: 'RlBJUjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=',
        finger_position: 'middle',
        hand: 'left',
        registered_at: new Date('2025-01-03')
      },
      {
        fingerprint_id: '4', // ID 4 in ESP32 sensor (for testing invalid)
        user_id: 'USER004',
        template_base64: 'RlBJUjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=',
        finger_position: 'index',
        hand: 'left',
        registered_at: new Date('2025-01-04')
      }
    ]);
    console.log('Fingerprint data created');

    // Create sensors
    await Sensor.insertMany([
      {
        sensor_id: 'SENS001',
        kind: 'temperature',
        unit: 'Celsius',
        status: 'active',
        device_id: 'DEV001'
      },
      {
        sensor_id: 'SENS002',
        kind: 'door_status',
        unit: 'boolean',
        status: 'active',
        device_id: 'DEV001'
      },
      {
        sensor_id: 'SENS003',
        kind: 'temperature',
        unit: 'Celsius',
        status: 'active',
        device_id: 'DEV002'
      }
    ]);
    console.log('Sensors created');

    // Create telemetry data
    const telemetryData = [];
    for (let i = 1; i <= 10; i++) {
      telemetryData.push({
        telemetry_id: `TEL${String(i).padStart(4, '0')}`,
        ts_utc: new Date(),
        value: 20 + Math.random() * 10,
        quality: 'good',
        sensor_id: i % 2 === 0 ? 'SENS001' : 'SENS003',
        device_id: i % 2 === 0 ? 'DEV001' : 'DEV002'
      });
    }
    await Telemetry.insertMany(telemetryData);
    console.log('Telemetry data created');

    // Create access logs
    const accessMethods = ['rfid', 'fingerprint', 'face'];
    const results = ['success', 'failed'];
    const userIds = ['USER003', 'USER004'];
    const deviceIds = ['DEV001', 'DEV002'];

    const accessLogs = [];
    for (let i = 1; i <= 20; i++) {
      const method = accessMethods[Math.floor(Math.random() * accessMethods.length)];
      const result = Math.random() > 0.2 ? 'success' : 'failed';
      const userId = userIds[Math.floor(Math.random() * userIds.length)];
      const deviceId = deviceIds[Math.floor(Math.random() * deviceIds.length)];
      
      const logDate = new Date();
      logDate.setDate(logDate.getDate() - Math.floor(Math.random() * 30));

      accessLogs.push({
        log_id: `LOG${String(i).padStart(4, '0')}`,
        access_method: method,
        result: result,
        time: logDate,
        user_id: userId,
        device_id: deviceId
      });
    }
    await AccessLog.insertMany(accessLogs);
    console.log('Access logs created');

    console.log('\nDatabase seeding completed successfully!');
    console.log('Summary:');
    console.log(`   - Organizations: ${await Organization.countDocuments()}`);
    console.log(`   - Users: ${await User.countDocuments()}`);
    console.log(`   - Devices: ${await Device.countDocuments()}`);
    console.log(`   - RFID Cards: ${await RFIDCard.countDocuments()}`);
    console.log(`   - Face Data: ${await Face.countDocuments()}`);
    console.log(`   - Fingerprints: ${await Fingerprint.countDocuments()}`);
    console.log(`   - Sensors: ${await Sensor.countDocuments()}`);
    console.log(`   - Telemetry: ${await Telemetry.countDocuments()}`);
    console.log(`   - Access Logs: ${await AccessLog.countDocuments()}`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seed function
seedDatabase();

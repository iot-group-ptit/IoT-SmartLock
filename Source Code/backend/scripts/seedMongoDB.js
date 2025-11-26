require('dotenv').config();
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Device = require('../models/Device');
const RFIDCard = require('../models/RFIDCard');
const BiometricData = require('../models/BiometricData');
const Sensor = require('../models/Sensor');
const Telemetry = require('../models/Telemetry');
const AccessLog = require('../models/AccessLog');

const seedDatabase = async () => {
  try {
    console.log('Starting MongoDB seeding...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Organization.deleteMany({});
    await User.deleteMany({});
    await Device.deleteMany({});
    await RFIDCard.deleteMany({});
    await BiometricData.deleteMany({});
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

    // Create users
    const users = await User.insertMany([
      {
        user_id: 'USER001',
        email: 'admin@ptit.edu.vn',
        full_name: 'System Administrator',
        phone: '0123456789',
        role: 'admin',
        org_id: org.org_id
      },
      {
        user_id: 'USER002',
        email: 'manager@ptit.edu.vn',
        full_name: 'User Manager',
        phone: '0987654321',
        role: 'user_manager',
        org_id: org.org_id
      },
      {
        user_id: 'USER003',
        email: 'user1@ptit.edu.vn',
        full_name: 'Nguyen Van A',
        phone: '0123111111',
        role: 'user',
        org_id: org.org_id
      },
      {
        user_id: 'USER004',
        email: 'user2@ptit.edu.vn',
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

    // Create RFID cards
    await RFIDCard.insertMany([
      {
        card_id: 'CARD001',
        uid: 'A1B2C3D4E5',
        issued_at: new Date('2025-01-01'),
        expired_at: new Date('2026-01-01'),
        user_id: 'USER003'
      },
      {
        card_id: 'CARD002',
        uid: 'F6G7H8I9J0',
        issued_at: new Date('2025-01-01'),
        expired_at: new Date('2026-01-01'),
        user_id: 'USER004'
      }
    ]);
    console.log('RFID cards created');

    // Create biometric data
    await BiometricData.insertMany([
      {
        bio_id: 'BIO001',
        biometric_type: 'fingerprint',
        registerd_at: new Date('2025-01-01'),
        user_id: 'USER003'
      },
      {
        bio_id: 'BIO002',
        biometric_type: 'fingerprint',
        registerd_at: new Date('2025-01-01'),
        user_id: 'USER004'
      },
      {
        bio_id: 'BIO003',
        biometric_type: 'face',
        registerd_at: new Date('2025-01-01'),
        user_id: 'USER003'
      }
    ]);
    console.log('Biometric data created');

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
    console.log(`   - Biometric Data: ${await BiometricData.countDocuments()}`);
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

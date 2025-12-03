const RFIDCard = require('../models/RFIDCard');
const User = require('../models/User');
const AccessLog = require('../models/AccessLog');
const BiometricData = require('../models/BiometricData');
const mqttClient = require('../config/mqtt');

// Authenticate RFID card
const authenticateRFID = async (req, res, next) => {
  try {
    const { cardId, device_id } = req.body;

    // Find RFID card by uid (cardId from ESP32 = uid in DB)
    const card = await RFIDCard.findOne({ uid: cardId })
      .populate('user_id', 'user_id full_name')
      .lean();

    let accessResult = 'failed';
    let userId = null;
    let message = 'Unknown card';

    if (card) {
      // Check if card is expired
      if (card.expired_at && new Date(card.expired_at) < new Date()) {
        accessResult = 'denied';
        message = 'Card expired';
        userId = card.user_id.user_id;
      } else {
        accessResult = 'success';
        userId = card.user_id.user_id;
        message = `Access granted for ${card.user_id.full_name}`;
      }
    }

    // Log access attempt
    await AccessLog.create({
      access_method: 'rfid',
      result: accessResult,
      user_id: userId,
      device_id
    });

    // Send MQTT response to device via control topic
    const unlockCommand = accessResult === 'success' ? 'unlock' : 'deny';
    mqttClient.publish('smartlock/control/unlock', JSON.stringify({
      command: unlockCommand,
      success: accessResult === 'success',
      method: 'rfid',
      cardId,
      message,
      timestamp: Date.now()
    }));

    // Send notification if failed or denied
    if (accessResult !== 'success' && global.io) {
      global.io.emit('access_alert', {
        type: 'rfid',
        result: accessResult,
        cardId,
        device_id,
        timestamp: new Date()
      });
    }

    res.json({
      success: accessResult === 'success',
      message,
      data: { accessResult, userId }
    });
  } catch (error) {
    next(error);
  }
};

// Authenticate fingerprint
const authenticateFingerprint = async (req, res, next) => {
  try {
    const { fingerprintId, device_id } = req.body;

    // Find fingerprint by fingerprint_id
    const Fingerprint = require('../models/Fingerprint');
    const fingerprint = await Fingerprint.findOne({ 
      fingerprint_id: String(fingerprintId)
    })
      .lean();

    let accessResult = 'failed';
    let userId = null;
    let userName = 'Unknown';
    let message = 'Unknown fingerprint';

    if (fingerprint) {
      // Get user info
      const user = await User.findOne({ user_id: fingerprint.user_id }).lean();
      if (user) {
        accessResult = 'success';
        userId = user.user_id;
        userName = user.full_name;
        message = `Access granted for ${user.full_name}`;
      }
    }

    // Log access attempt
    await AccessLog.create({
      user_id: userId,
      access_method: 'fingerprint',
      result: accessResult,
      device_id,
      additional_info: JSON.stringify({ fingerprintId })
    });

    // Send MQTT response via control topic
    const unlockCommand = accessResult === 'success' ? 'unlock' : 'deny';
    mqttClient.publish('smartlock/control/unlock', JSON.stringify({
      command: unlockCommand,
      success: accessResult === 'success',
      method: 'fingerprint',
      fingerprintId,
      message,
      timestamp: Date.now()
    }));

    // Send notification if failed
    if (accessResult !== 'success' && global.io) {
      global.io.emit('access_alert', {
        type: 'fingerprint',
        result: accessResult,
        fingerprintId,
        device_id,
        timestamp: new Date()
      });
    }

    res.json({
      success: accessResult === 'success',
      message,
      data: { accessResult, userId }
    });
  } catch (error) {
    next(error);
  }
};

// Remote unlock (from app)
const remoteUnlock = async (req, res, next) => {
  try {
    const { device_id, reason } = req.body;
    const userId = req.user.userId;

    // Log access
    await AccessLog.create({
      user_id: userId,
      access_method: 'remote',
      result: 'success',
      device_id,
      additional_info: JSON.stringify({ reason: reason || 'Remote unlock from app' })
    });

    // Send MQTT command to unlock
    const topic = `smartlock/${device_id}/command`;
    mqttClient.publish(topic, {
      command: 'unlock',
      userId,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Unlock command sent successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get door status
const getDoorStatus = async (req, res, next) => {
  try {
    const { device_id } = req.params;

    const Device = require('../models/Device');
    // Get device
    const device = await Device.findOne({ device_id }).lean();

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    res.json({
      success: true,
      data: device
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticateRFID,
  authenticateFingerprint,
  remoteUnlock,
  getDoorStatus
};

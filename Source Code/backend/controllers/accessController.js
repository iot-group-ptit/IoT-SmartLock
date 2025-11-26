const RFIDCard = require('../models/RFIDCard');
const User = require('../models/User');
const AccessLog = require('../models/AccessLog');
const BiometricData = require('../models/BiometricData');
const mqttClient = require('../config/mqtt');

// Authenticate RFID card
const authenticateRFID = async (req, res, next) => {
  try {
    const { card_uid, device_id } = req.body;

    // Find RFID card with user info
    const card = await RFIDCard.findOne({ uid: card_uid })
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

    // Send MQTT response to device
    const topic = `smartlock/${device_id}/response`;
    mqttClient.publish(topic, {
      success: accessResult === 'success',
      method: 'rfid',
      message,
      timestamp: new Date().toISOString()
    });

    // Send notification if failed or denied
    if (accessResult !== 'success' && global.io) {
      global.io.emit('access_alert', {
        type: 'rfid',
        result: accessResult,
        card_uid,
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
    const { bio_id, device_id } = req.body;

    // Find fingerprint with user info
    const fingerprint = await BiometricData.findOne({ 
      bio_id, 
      biometric_type: 'fingerprint' 
    })
      .populate('user_id', 'user_id full_name')
      .lean();

    let accessResult = 'failed';
    let userId = null;
    let message = 'Unknown fingerprint';

    if (fingerprint && fingerprint.user_id) {
      accessResult = 'success';
      userId = fingerprint.user_id.user_id;
      message = `Access granted for ${fingerprint.user_id.full_name}`;
    }

    // Log access attempt
    await AccessLog.create({
      user_id: userId,
      access_method: 'fingerprint',
      result: accessResult,
      device_id,
      additional_info: JSON.stringify({ bio_id })
    });

    // Send MQTT response
    const topic = `smartlock/${device_id}/response`;
    mqttClient.publish(topic, {
      success: accessResult === 'success',
      method: 'fingerprint',
      message,
      timestamp: new Date().toISOString()
    });

    // Send notification if failed
    if (accessResult !== 'success' && global.io) {
      global.io.emit('access_alert', {
        type: 'fingerprint',
        result: accessResult,
        bio_id,
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

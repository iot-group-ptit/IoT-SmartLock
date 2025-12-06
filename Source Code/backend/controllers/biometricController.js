const RFIDCard = require('../models/RFIDCard');
const Fingerprint = require('../models/Fingerprint');
const Face = require('../models/Face');
const User = require('../models/User');

// Get user's RFID cards
const getUserRFIDCards = async (req, res, next) => {
  try {
    const { user_id } = req.params;

    const cards = await RFIDCard.find({ user_id })
      .select('card_id uid issued_at expired_at')
      .lean();

    res.json({
      success: true,
      data: cards
    });
  } catch (error) {
    next(error);
  }
};

// Delete RFID card
const deleteRFIDCard = async (req, res, next) => {
  try {
    const { card_id } = req.params;

    const card = await RFIDCard.findOneAndDelete({ card_id });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }

    res.json({
      success: true,
      message: 'Card deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Add fingerprint (with MQTT enrollment flow)
const addFingerprint = async (req, res, next) => {
  try {
    const { user_id, finger_position, hand } = req.body;

    // Check if user exists
    const user = await User.findOne({ user_id });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if this finger already registered
    const existing = await Fingerprint.findOne({ 
      user_id, 
      finger_position, 
      hand 
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `${hand} ${finger_position} finger already registered`
      });
    }

    // Publish MQTT to start enrollment on ESP32
    const mqttClient = require('../config/mqtt');
    const enrollData = {
      command: 'enroll_start',
      user_id,
      finger_position,
      hand,
      timestamp: Date.now()
    };
    
    mqttClient.publish('smartlock/enroll/start', JSON.stringify(enrollData));

    // Return response
    res.status(202).json({
      success: true,
      message: 'Enrollment started. Please place finger on sensor.',
      data: {
        status: 'pending',
        instruction: 'Place your finger on the sensor 3 times'
      }
    });

    // Note: When ESP32 completes enrollment, it will publish to 
    // 'smartlock/enroll/success' with fingerprintId
    // MQTT handler in mqtt.js will save to database

  } catch (error) {
    next(error);
  }
};

// Get user's fingerprints
const getUserFingerprints = async (req, res, next) => {
  try {
    const { user_id } = req.params;

    const fingerprints = await Fingerprint.find({ user_id })
      .select('fingerprint_id finger_position hand registered_at')
      .lean();

    res.json({
      success: true,
      data: fingerprints
    });
  } catch (error) {
    next(error);
  }
};

// Delete fingerprint
const deleteFingerprint = async (req, res, next) => {
  try {
    const { fingerprint_id } = req.params;

    const fingerprint = await Fingerprint.findOneAndDelete({ fingerprint_id });

    if (!fingerprint) {
      return res.status(404).json({
        success: false,
        message: 'Fingerprint not found'
      });
    }

    res.json({
      success: true,
      message: 'Fingerprint deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserRFIDCards,
  deleteRFIDCard,
  addFingerprint,
  getUserFingerprints,
  deleteFingerprint
};

const RFIDCard = require('../models/RFIDCard');
const BiometricData = require('../models/BiometricData');
const User = require('../models/User');

// Add RFID card
const addRFIDCard = async (req, res, next) => {
  try {
    const { card_id, uid, issued_at, expired_at, user_id } = req.body;

    // Check if card already exists
    const existingCard = await RFIDCard.findOne({ uid });

    if (existingCard) {
      return res.status(409).json({
        success: false,
        message: 'Card UID already registered'
      });
    }

    // Check if user exists
    const user = await User.findOne({ user_id });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Insert card
    const card = await RFIDCard.create({
      card_id,
      uid,
      issued_at,
      expired_at,
      user_id
    });

    res.status(201).json({
      success: true,
      message: 'RFID card added successfully',
      data: { cardId: card.card_id }
    });
  } catch (error) {
    next(error);
  }
};

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

// Update RFID card
const updateRFIDCard = async (req, res, next) => {
  try {
    const { card_id } = req.params;
    const { uid, expired_at } = req.body;

    const updateData = {};
    if (uid !== undefined) updateData.uid = uid;
    if (expired_at !== undefined) updateData.expired_at = expired_at;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    const card = await RFIDCard.findOneAndUpdate(
      { card_id },
      updateData,
      { new: true }
    );

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }

    res.json({
      success: true,
      message: 'Card updated successfully'
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

// Add biometric data (fingerprint or face)
const addBiometricData = async (req, res, next) => {
  try {
    const { bio_id, biometric_type, data_template, user_id } = req.body;

    // Check if user exists
    const user = await User.findOne({ user_id });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if bio_id already exists
    const existing = await BiometricData.findOne({ bio_id });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Biometric ID already exists'
      });
    }

    // Insert biometric data
    const biometric = await BiometricData.create({
      bio_id,
      biometric_type,
      data_template,
      user_id
    });

    res.status(201).json({
      success: true,
      message: `${biometric_type} added successfully`,
      data: { bioId: biometric.bio_id }
    });
  } catch (error) {
    next(error);
  }
};

// Get user's fingerprints
const getUserFingerprints = async (req, res, next) => {
  try {
    const { user_id } = req.params;

    const fingerprints = await BiometricData.find({ 
      user_id, 
      biometric_type: 'fingerprint' 
    })
      .select('bio_id biometric_type registered_at')
      .lean();

    res.json({
      success: true,
      data: fingerprints
    });
  } catch (error) {
    next(error);
  }
};

// Update fingerprint
const updateFingerprint = async (req, res, next) => {
  try {
    const { bio_id } = req.params;
    const { data_template } = req.body;

    if (!data_template) {
      return res.status(400).json({
        success: false,
        message: 'No data to update'
      });
    }

    const fingerprint = await BiometricData.findOneAndUpdate(
      { bio_id, biometric_type: 'fingerprint' },
      { data_template },
      { new: true }
    );

    if (!fingerprint) {
      return res.status(404).json({
        success: false,
        message: 'Fingerprint not found'
      });
    }

    res.json({
      success: true,
      message: 'Fingerprint updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Delete fingerprint
const deleteFingerprint = async (req, res, next) => {
  try {
    const { bio_id } = req.params;

    const fingerprint = await BiometricData.findOneAndDelete({ 
      bio_id, 
      biometric_type: 'fingerprint' 
    });

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
  addRFIDCard,
  getUserRFIDCards,
  updateRFIDCard,
  deleteRFIDCard,
  addBiometricData,
  getUserFingerprints,
  updateFingerprint,
  deleteFingerprint
};

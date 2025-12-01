const validator = require('validator');

// Validate user registration
const validateUserRegistration = (req, res, next) => {
  const { username, email, password, full_name } = req.body;
  const errors = [];

  if (!username || username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }

  if (!email || !validator.isEmail(email)) {
    errors.push('Invalid email format');
  }

  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (!full_name || full_name.trim().length === 0) {
    errors.push('Full name is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

// Validate user login
const validateUserLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || !validator.isEmail(email)) {
    errors.push('Valid email is required');
  }

  if (!password || password.trim().length === 0) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

// Validate RFID card
const validateRFIDCard = (req, res, next) => {
  const { card_uid, user_id } = req.body;
  const errors = [];

  if (!card_uid || card_uid.trim().length === 0) {
    errors.push('Card UID is required');
  }

  if (!user_id || isNaN(user_id)) {
    errors.push('Valid user ID is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

// Validate fingerprint
const validateFingerprint = (req, res, next) => {
  const { user_id, fingerprint_id } = req.body;
  const errors = [];

  if (!user_id || isNaN(user_id)) {
    errors.push('Valid user ID is required');
  }

  if (fingerprint_id === undefined || isNaN(fingerprint_id)) {
    errors.push('Valid fingerprint ID is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

// Sanitize input
const sanitizeInput = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = validator.escape(req.body[key].trim());
      }
    });
  }
  next();
};

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validateRFIDCard,
  validateFingerprint,
  sanitizeInput
};

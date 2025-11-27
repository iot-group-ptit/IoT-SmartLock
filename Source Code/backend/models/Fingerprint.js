const mongoose = require('mongoose');

const fingerprintSchema = new mongoose.Schema({
  fingerprint_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  user_id: {
    type: String,
    required: true,
    index: true
  },
  template_base64: {
    type: String,
    required: true
  },
  finger_position: {
    type: String,
    enum: ['thumb', 'index', 'middle', 'ring', 'pinky', 'unknown'],
    default: 'unknown'
  },
  hand: {
    type: String,
    enum: ['left', 'right', 'unknown'],
    default: 'unknown'
  },
  registered_at: {
    type: Date,
    default: Date.now
  }
});

fingerprintSchema.index({ user_id: 1, registered_at: -1 });

module.exports = mongoose.model('Fingerprint', fingerprintSchema);

const mongoose = require('mongoose');

const biometricDataSchema = new mongoose.Schema({
  bio_id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  biometric_type: {
    type: String,
    required: true,
    enum: ['fingerprint', 'face'],
    trim: true
  },
  data_template: {
    type: Buffer
  },
  registerd_at: {
    type: Date,
    default: Date.now
  },
  user_id: {
    type: String,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  collection: 'biometric_data'
});

// Indexes
biometricDataSchema.index({ bio_id: 1 });
biometricDataSchema.index({ biometric_type: 1 });
biometricDataSchema.index({ user_id: 1 });

module.exports = mongoose.model('BiometricData', biometricDataSchema);

const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  device_id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  type: {
    type: String,
    trim: true,
    maxlength: 20
  },
  model: {
    type: String,
    trim: true,
    maxlength: 100
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'maintenance'],
    default: 'offline'
  },
  fw_current: {
    type: String,
    trim: true
  },
  org_id: {
    type: String,
    ref: 'Organization'
  }
}, {
  timestamps: true,
  collection: 'devices'
});

// Indexes
deviceSchema.index({ device_id: 1 });
deviceSchema.index({ status: 1 });
deviceSchema.index({ org_id: 1 });

module.exports = mongoose.model('Device', deviceSchema);

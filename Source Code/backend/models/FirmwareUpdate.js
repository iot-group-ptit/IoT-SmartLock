const mongoose = require('mongoose');

const firmwareUpdateSchema = new mongoose.Schema({
  update_id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  from_version: {
    type: String,
    trim: true
  },
  to_version: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending'
  },
  start_ts: {
    type: Date
  },
  end_ts: {
    type: Date
  },
  device_id: {
    type: String,
    ref: 'Device',
    required: true
  }
}, {
  timestamps: true,
  collection: 'firmware_updates'
});

// Indexes
firmwareUpdateSchema.index({ update_id: 1 });
firmwareUpdateSchema.index({ status: 1 });
firmwareUpdateSchema.index({ device_id: 1 });

module.exports = mongoose.model('FirmwareUpdate', firmwareUpdateSchema);

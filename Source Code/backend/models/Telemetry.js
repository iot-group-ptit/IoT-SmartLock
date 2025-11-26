const mongoose = require('mongoose');

const telemetrySchema = new mongoose.Schema({
  telemetry_id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  ts_utc: {
    type: Date,
    default: Date.now
  },
  value: {
    type: Number,
    required: true
  },
  quality: {
    type: String,
    trim: true
  },
  sensor_id: {
    type: String,
    ref: 'Sensor',
    required: true
  },
  device_id: {
    type: String,
    ref: 'Device',
    required: true
  }
}, {
  timestamps: true,
  collection: 'telemetry'
});

// Indexes
telemetrySchema.index({ telemetry_id: 1 });
telemetrySchema.index({ ts_utc: -1 });
telemetrySchema.index({ sensor_id: 1 });
telemetrySchema.index({ device_id: 1 });

module.exports = mongoose.model('Telemetry', telemetrySchema);

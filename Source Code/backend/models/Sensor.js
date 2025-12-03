const mongoose = require("mongoose");

const sensorSchema = new mongoose.Schema(
  {
    sensor_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    kind: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      trim: true,
    },
    device_id: {
      type: String,
      ref: "Device",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "sensors",
  }
);

// Indexes
// sensorSchema.index({ sensor_id: 1 });
// sensorSchema.index({ kind: 1 });
// sensorSchema.index({ device_id: 1 });

module.exports = mongoose.model("Sensor", sensorSchema);

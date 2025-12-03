const mongoose = require("mongoose");

const accessLogSchema = new mongoose.Schema(
  {
    log_id: {
      type: String,
      unique: true,
      trim: true,
      sparse: true, // Allow multiple null values
    },
    access_method: {
      type: String,
      required: true,
      enum: ["rfid", "fingerprint", "face"],
      trim: true,
    },
    result: {
      type: String,
      required: true,
      enum: ["success", "failed", "denied"],
      trim: true,
    },
    time: {
      type: Date,
      default: Date.now,
    },
    user_id: {
      type: String,
      ref: "User",
    },
    device_id: {
      type: String,
      ref: "Device",
    },
    additional_info: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "access_logs",
  }
);

// Indexes
// accessLogSchema.index({ log_id: 1 });
// accessLogSchema.index({ access_method: 1 });
// accessLogSchema.index({ result: 1 });
// accessLogSchema.index({ time: -1 });
// accessLogSchema.index({ user_id: 1 });
// accessLogSchema.index({ device_id: 1 });

module.exports = mongoose.model("AccessLog", accessLogSchema);

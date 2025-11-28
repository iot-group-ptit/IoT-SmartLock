const mongoose = require("mongoose");

const accessLogSchema = new mongoose.Schema(
  {
    log_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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
      enum: ["success", "failed"],
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

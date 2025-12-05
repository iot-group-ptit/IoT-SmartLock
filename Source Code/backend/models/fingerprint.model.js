const mongoose = require("mongoose");

const fingerprintSchema = new mongoose.Schema({
  fingerprint_id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  device_id: {
    type: String,
    ref: "Device",
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Fingerprint", fingerprintSchema);

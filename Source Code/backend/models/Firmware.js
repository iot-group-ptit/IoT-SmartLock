// models/Firmware.js
const mongoose = require("mongoose");

const firmwareSchema = new mongoose.Schema({
  version: { type: String, required: true, unique: true },
  file_name: { type: String, required: true },
  file_size: Number,
  sha256: { type: String, required: true },
  signature: { type: String, required: true },
  uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  is_active: { type: Boolean, default: true },
  release_note: String
}, { timestamps: true });

module.exports = mongoose.model("Firmware", firmwareSchema);
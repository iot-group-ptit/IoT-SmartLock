const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    device_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    model: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    status: {
      type: String,
      enum: ["pending", "registered", "online", "offline", "blocked"],
      default: "pending",
    },
    public_key: {
      type: String,
      default: null,
    },
    certificate: {
      type: String,
      default: null,
    },
    fw_current: {
      type: String,
      trim: true,
    },
    org_id: {
      type: String,
      ref: "Organization",
    },
    challenge: {
      type: String,
      default: null,
    },
    challenge_created_at: {
      type: Date,
      default: null,
    },
    last_seen: {
      type: Date,
      default: null,
    },
    provisioning_token: {
      type: String,
      default: null,
    },
    provisioning_token_expires: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "devices",
  }
);

// ✅ CHỈ EXPORT Device MODEL, KHÔNG export AccessLog
module.exports = mongoose.model("Device", deviceSchema);

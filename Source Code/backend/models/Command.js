const mongoose = require("mongoose");

const commandSchema = new mongoose.Schema(
  {
    command_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    parameters: {
      type: String,
      trim: true,
    },
    sent_ts: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "executed", "failed"],
      default: "pending",
    },
    device_id: {
      type: String,
      ref: "Device",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "commands",
  }
);

// Indexes
// commandSchema.index({ command_id: 1 });
// commandSchema.index({ name: 1 });
// commandSchema.index({ status: 1 });
// commandSchema.index({ device_id: 1 });

module.exports = mongoose.model("Command", commandSchema);

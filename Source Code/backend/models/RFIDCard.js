const mongoose = require("mongoose");

const rfidCardSchema = new mongoose.Schema(
  {
    card_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    uid: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    issued_at: {
      type: Date,
      default: Date.now,
    },
    expired_at: {
      type: Date,
    },
    user_id: {
      type: String,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "rfid_cards",
  }
);

// Indexes
// rfidCardSchema.index({ uid: 1 });
// rfidCardSchema.index({ card_id: 1 });
// rfidCardSchema.index({ user_id: 1 });

module.exports = mongoose.model("RFIDCard", rfidCardSchema);

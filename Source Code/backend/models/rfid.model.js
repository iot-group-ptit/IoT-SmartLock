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
    createdAt: {
      type: Date,
      default: Date.now,
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

module.exports = mongoose.model("RFIDCard", rfidCardSchema);

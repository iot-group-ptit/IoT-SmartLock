const mongoose = require("mongoose");

const faceSchema = new mongoose.Schema({
  face_id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  user_id: {
    type: String,
    required: true,
    index: true,
  },
  image_base64: {
    type: String,
    required: true,
  },
  registered_at: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Face", faceSchema);

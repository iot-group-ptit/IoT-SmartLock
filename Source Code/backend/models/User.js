const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
    },
    full_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 15,
    },
    role: {
      type: String,
      enum: ["admin", "user_manager", "user"],
      default: "user",
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    org_id: {
      type: String,
      ref: "Organization",
    },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

// Indexes
// userSchema.index({ email: 1 });
// userSchema.index({ user_id: 1 });
// userSchema.index({ role: 1 });
// userSchema.index({ org_id: 1 });

module.exports = mongoose.model("User", userSchema);

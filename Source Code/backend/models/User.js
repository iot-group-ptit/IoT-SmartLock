const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    user_id: {
      type: String,
      unique: true,
      trim: true,
      default: function() {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 7).toUpperCase();
        return `USER_${timestamp}_${random}`;
      }
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
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

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Indexes
// userSchema.index({ email: 1 });
// userSchema.index({ user_id: 1 });
// userSchema.index({ role: 1 });
// userSchema.index({ org_id: 1 });

module.exports = mongoose.model("User", userSchema);

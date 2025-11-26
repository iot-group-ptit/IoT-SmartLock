const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  org_id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  address: {
    type: String,
    trim: true,
    maxlength: 255
  }
}, {
  timestamps: true,
  collection: 'organizations'
});

// Indexes
organizationSchema.index({ name: 1 });
organizationSchema.index({ org_id: 1 });

module.exports = mongoose.model('Organization', organizationSchema);

// models/admin.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const adminSchema = new mongoose.Schema({
  adminId: {
    type: String,
    default: uuidv4,
    unique: true,
    immutable: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  emailOtp: {
    code: String,
    expires: Date
  },
  // store pending email-update requests
  updateEmailOtp: {
    code: String,
    newEmail: String,
    expires: Date
  },
  resetOtp: {
    code: String,
    expires: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Admin', adminSchema);

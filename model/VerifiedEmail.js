// model/VerifiedEmail.js
const mongoose = require('mongoose');

const verifiedEmailSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  otpCode: String,
  otpExpiresAt: Date,
  otpVerified: { type: Boolean, default: false }
}, { timestamps: true });

// unique by email
verifiedEmailSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('VerifiedEmail', verifiedEmailSchema);

// model/User.js
const mongoose   = require('mongoose');
const bcrypt     = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    default: () => uuidv4()
  },
  // Registered user profile (created only AFTER email verification)
  name: { type: String, required: true },

  email: {
    type: String,
    required: true,
    unique: true,          // user emails are unique
    lowercase: true,
    trim: true
  },

  password: { type: String, required: true },

  phone: {
    type: String,
    required: true,
    unique: true,          // now safe: users are created only after registration
    trim: true
  },

  countryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Country',
    required: true
  },
  country: { type: String, required: true },

  callingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Country',
    required: true
  },
  callingcode: { type: String, required: true },

  gender: { type: Number, enum: [0, 1, 2], required: true }, // 0=male,1=female,2=other

  // Password-reset support (kept here)
  passwordResetCode: String,
  passwordResetExpiresAt: Date,
  passwordResetVerified: { type: Boolean, default: false }

}, { timestamps: true });

// Helpful indexes
userSchema.index({ userId: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true });

// Hash password whenever modified
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare helper
userSchema.methods.comparePassword = function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);

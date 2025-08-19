// models/User.js
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
  name: {
    type: String,
    required: function() { return this.otpVerified; }
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
    required: function() { return this.otpVerified; }
  },
  phone: {
    type: String,
    unique: true,
    trim: true,
    required: function() { return this.otpVerified; }
  },

  // OTP support
  otpCode:      String,
  otpExpiresAt: Date,
  otpVerified:  { type: Boolean, default: false },

  // Profile fields (required only once otpVerified)
  countryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Country',
    required: function() { return this.otpVerified; }
  },
  country: {
    type: String,
    required: function() { return this.otpVerified; }
  },
  callingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Country',
    required: function() { return this.otpVerified; }
  },
  callingcode: {
    type: String,
    required: function() { return this.otpVerified; }
  },
  gender: {
    type: Number,
    enum: [0, 1, 2], // 0=male,1=female,2=other
    required: function() { return this.otpVerified; }
  },

  // Password-reset support
  passwordResetCode:      String,
  passwordResetExpiresAt: Date,
  passwordResetVerified:  { type: Boolean, default: false }

}, { timestamps: true });


// Hash password whenever modified
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, await bcrypt.genSalt(10));
  next();
});

// Compare helper
userSchema.methods.comparePassword = function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);

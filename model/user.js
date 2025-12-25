// model/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    default: () => uuidv4()
  },

  // local | google
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local',
    index: true,
  },

  // Google metadata (when authProvider = 'google')
  googleUid: { type: String, index: true, sparse: true },
  picture: String,
  emailVerified: { type: Boolean, default: false },

  // Profile
  name: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  socialMedia: [
    {
      platform: {
        type: String,
        enum: ["instagram", "youtube", "linkedin"],
        required: true,
      },
      url: { type: String, trim: true, default: "" },
    },
  ],
  // Required only for local users
  password: {
    type: String,
    required: function () { return this.authProvider === 'local'; }
  },

  // Optional for google users; unique sparse index handled below
  phone: {
    type: String,
    trim: true
  },

  countryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Country',
    required: function () { return this.authProvider === 'local'; }
  },
  country: {
    type: String,
    required: function () { return this.authProvider === 'local'; }
  },

  callingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Country',
    required: function () { return this.authProvider === 'local'; }
  },
  callingcode: {
    type: String,
    required: function () { return this.authProvider === 'local'; }
  },

  gender: {
    type: Number, enum: [0, 1, 2],
    required: function () { return this.authProvider === 'local'; }
  },

  pendingEmail: { type: String, lowercase: true, trim: true }, // new email waiting for verification
  emailChangeCodeHash: { type: String },                       // hashed OTP
  emailChangeExpiresAt: { type: Date },
  emailChangeVerified: { type: Boolean, default: false },
  // Password-reset support (local only in practice)
  passwordResetCode: String,
  passwordResetExpiresAt: Date,
  passwordResetVerified: { type: Boolean, default: false }

}, { timestamps: true });

// Indexes
userSchema.index({ userId: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });

// IMPORTANT: sparse so multiple docs without 'phone' are allowed
userSchema.index({ phone: 1 }, { unique: true, sparse: true });

// Hash password whenever modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare helper
userSchema.methods.comparePassword = function (candidate) {
  if (!this.password) return false; // google user has no password
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);

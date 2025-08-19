// models/Subscription.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const subscriptionSchema = new mongoose.Schema({
  subscriptionId: {
    type: String,
    required: true,
    unique: true,
    default: () => uuidv4()
  },

  // references/foreign keys (using UUID strings)
  userId:   { type: String, required: true, ref: 'User', index: true },
  planId:   { type: String, required: true, ref: 'Plan', index: true },
  pricingId:{ type: String, required: true },

  // denormalized helpful fields
  planName:    { type: String, required: true },         // fetched from Plan.name
  profileLink: { type: String, required: true },         // provided at order time

  // payment linkage
  orderId:   { type: String, required: true, index: true },
  paymentId: { type: String, required: true },

  amount:   { type: Number, required: true },            // minor units (e.g., cents/paise)
  currency: { type: String, required: true },

  // lifecycle of subscription itself (we only create when active)
  status: {
    type: String,
    enum: ['active','cancelled','expired'],
    default: 'active'
  },

  // admin-only status: 0=in process (default), 1=completed
  Status: { type: Number, enum: [0,1], default: 0 },

  startedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);

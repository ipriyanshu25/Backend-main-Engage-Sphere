// models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  orderId:   { type: String, required: true, unique: true, index: true },
  paymentId: { type: String },
  signature: { type: String },

  amount:   { type: Number, required: true },  // minor units
  currency: { type: String, required: true, default: 'USD' },
  receipt:  { type: String },

  // who/what
  userId:    { type: String, required: true, index: true },
  planId:    { type: String, required: true, index: true },
  pricingId: { type: String, required: true },

  // store profileLink here until payment verifies, then copy into Subscription
  profileLink: { type: String, required: true },

  status: { 
    type: String, 
    enum: ['created', 'paid', 'failed'], 
    default: 'created',
    index: true
  },

  createdAt: { type: Date, default: Date.now },
  paidAt:    { type: Date }
});

module.exports = mongoose.model('Payment', paymentSchema);

// models/receipt.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

/**
 * Receipt Schema
 * Stores the details needed to regenerate or fetch a PDF receipt anytime via a unique receiptId.
 */
const receiptSchema = new mongoose.Schema(
  {
    receiptId: {
      type: String,
      unique: true,
      default: () => uuidv4(),
      index: true,
      description: 'Unique ID for retrieving this receipt',
    },
    orderId: {
      type: String,
      required: true,
      index: true,
      description: 'PayPal order ID',
    },
    transactionId: {
      type: String,
      required: true,
      description: 'PayPal transaction capture ID',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      description: 'Reference to the User who made the payment',
    },
    payerName: {
      type: String,
      required: true,
      description: 'Full name of the payer',
    },
    payerEmail: {
      type: String,
      required: true,
      description: 'Email address of the payer',
    },
    packageName: {
      type: String,
      required: true,
      description: 'Name of the purchased package',
    },
    packageFeatures: {
      type: [String],
      default: [],
      description: 'List of features included in the package',
    },
    amount: {
      type: Number,
      required: true,
      description: 'Amount paid',
    },
    currency: {
      type: String,
      required: true,
      description: 'Currency code (e.g. USD)',
    },
    status: {
      type: String,
      required: true,
      description: 'Payment status (e.g. COMPLETED)',
    },
    create_time: {
      type: Date,
      required: true,
      description: 'Timestamp when the payment was created',
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Static method to fetch receipt by its unique receiptId
 */
receiptSchema.statics.findByReceiptId = function (rid) {
  return this.findOne({ receiptId: rid });
};

module.exports = mongoose.model('Receipt', receiptSchema);

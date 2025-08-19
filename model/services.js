// models/services.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const contentSchema = new mongoose.Schema({
  contentId: {
    type: String,
    default: uuidv4,
    unique: true
  },
  key: {
    type: String,
    required: true,
    trim: true
  }
});

const serviceSchema = new mongoose.Schema({
  serviceId: {
    type: String,
    default: uuidv4,
    unique: true
  },
  serviceHeading: {
    type: String,
    required: true,
    trim: true
  },
  serviceDescription: {
    type: String,
    required: true,
    trim: true
  },
  serviceContent: {
    type: [contentSchema],
    default: []
  },
  // Store logo as base64 string
  logo: {
    type: String,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Services', serviceSchema);

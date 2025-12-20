// model/services.js
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const contentSchema = new mongoose.Schema(
  {
    contentId: { type: String, default: () => uuidv4() },
    key: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const subServiceSchema = new mongoose.Schema(
  {
    // ✅ remove "index: true" to avoid duplicate schema index warning
    subServiceId: { type: String, default: () => uuidv4() },

    subServiceHeading: { type: String, required: true, trim: true },
    subServiceDescription: { type: String, required: true, trim: true },

    // ✅ multer file path
    logo: { type: String, default: null },

    subServiceContent: { type: [contentSchema], default: [] },
  },
  { _id: false }
);

const serviceSchema = new mongoose.Schema(
  {
    serviceId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      index: true,
    },

    serviceHeading: { type: String, required: true, trim: true },
    serviceDescription: { type: String, required: true, trim: true },

    // ✅ multer file path
    logo: { type: String, default: null },

    serviceContent: { type: [contentSchema], default: [] },

    subServices: { type: [subServiceSchema], default: [] },
  },
  { timestamps: true }
);

// ✅ keep only ONE index definition for subServiceId uniqueness
serviceSchema.index({ "subServices.subServiceId": 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Services", serviceSchema);

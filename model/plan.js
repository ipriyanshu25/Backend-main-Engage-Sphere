// model/plan.js
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const PricingSchema = new mongoose.Schema(
  {
    pricingId: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true,
    },
    name: { type: String, required: true },
    price: { type: String, required: true },
    description: { type: String, default: "" },
    features: [String],
    isPopular: { type: Boolean, default: false },
  },
  { _id: false }
);

const PlanSchema = new mongoose.Schema(
  {
    planId: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true,
    },

    // ✅ new fields
    serviceId: { type: String, required: true, index: true },
    subServiceId: { type: String, required: true, index: true },

    // keep your name (plan name = subServiceHeading recommended)
    name: { type: String, required: true },

    pricing: [PricingSchema],

    status: {
      type: String,
      enum: ["Active", "Inactive", "Pending"],
      default: "Active",
    },
  },
  { timestamps: true }
);

// ✅ One plan per subservice
PlanSchema.index({ serviceId: 1, subServiceId: 1 }, { unique: true });

module.exports = mongoose.model("Plan", PlanSchema);

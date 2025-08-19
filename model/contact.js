

const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    user_name: { type: String, required: true, trim: true },
    user_email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/.+@.+\..+/, "Invalid email"],
    },
    serviceType: {
      type: String,
      required: true,
      enum: ["growth", "consultation", "management", "security", "custom"],
    },
    platform: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Contact", contactSchema);

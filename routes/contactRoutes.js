

const express = require("express");
const router = express.Router();

// Import controller methods
const {
  submitContactForm,
  getAllContacts,
} = require("../controller/contactController");

// @route   POST /contact/contact
// @desc    Submit contact form (User)
router.post("/contact", submitContactForm);

// @route   GET /contact/all
// @desc    Get all contact messages (Admin)
router.get("/all", getAllContacts);

module.exports = router;

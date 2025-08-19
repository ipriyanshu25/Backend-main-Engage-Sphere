

// controller/contactController.js

const Contact = require("../model/contact");

// ✅ POST /contact - Save contact message
exports.submitContactForm = async (req, res) => {
  try {
    const { user_name, user_email, serviceType, platform, message } = req.body;

    // Basic validation
    if (!user_name || !user_email || !serviceType || !platform || !message) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const newContact = new Contact({
      user_name,
      user_email,
      serviceType,
      platform,
      message,
    });

    await newContact.save();
    console.log("✅ Contact message saved to MongoDB");

    res.status(201).json({ message: "Message submitted successfully!" });
  } catch (err) {
    console.error("❌ Error saving contact form:", err.message || err);
    res.status(500).json({ message: "Server error. Try again later." });
  }
};

// ✅ GET /contact/all - Fetch all messages for Admin
exports.getAllContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    console.log(`📨 Fetched ${contacts.length} contact messages`);
    res.status(200).json(contacts);
  } catch (err) {
    console.error("❌ Error fetching contact messages:", err.message || err);
    res.status(500).json({ message: "Failed to load contact messages." });
  }
};

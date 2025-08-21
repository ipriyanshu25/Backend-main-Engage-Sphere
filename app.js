
// ✅ Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// ✅ Import Routes
const userRoutes = require('./routes/userRoutes');
const contactRoutes = require("./routes/contactRoutes"); 
const paymentRoutes = require('./routes/paymentRoutes');
const receiptRoutes = require('./routes/receiptRoutes'); 
const plan = require('./routes/planRoutes');
const adminRoutes = require('./routes/adminRoutes'); // ✅ NEW: admin panel API
const service = require('./routes/servicesRoutes')
const countryRoutes = require('./routes/countryRoutes'); // ✅ NEW: country API
const subscriptionRoutes = require('./routes/subscriptionRoutes'); // ✅ NEW: subscription API

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'https://liklet.com',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Mount Routes
app.use('/user', userRoutes);         // Auth, profile, getAll (admin protected)
app.use("/contact", contactRoutes);   // User contact form
app.use('/payment', paymentRoutes);   // Payment-related APIs
app.use('/receipt', receiptRoutes);   // Invoice / PDF preview
app.use('/plan', plan);   // View/update services
app.use('/admin', adminRoutes);       // ✅ Admin dashboard metrics or control
app.use('/services', service); // ✅ NEW: services API
app.use('/country', countryRoutes); // ✅ NEW: country API
app.use('/subscription', subscriptionRoutes); // ✅ NEW: subscription API

// ✅ Connect to MongoDB and Start Server (Updated)
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI) // 🛠️ Removed deprecated options
  .then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

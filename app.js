// ✅ Load environment variables from .env file
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

// ✅ Import Routes
const userRoutes = require("./routes/userRoutes");
const contactRoutes = require("./routes/contactRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const receiptRoutes = require("./routes/receiptRoutes");
const plan = require("./routes/planRoutes");
const adminRoutes = require("./routes/adminRoutes");
const serviceRoutes = require("./routes/servicesRoutes");
const countryRoutes = require("./routes/countryRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");

const app = express();

app.use(
  cors({
    origin:
      process.env.FRONTEND_ORIGIN || [
        "https://liklet.com",
        "http://localhost:3000",
        "http://localhost:5173",
      ],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ serve uploads folder
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ✅ Mount Routes
app.use("/user", userRoutes);
app.use("/contact", contactRoutes);
app.use("/payment", paymentRoutes);
app.use("/receipt", receiptRoutes);
app.use("/plan", plan);
app.use("/admin", adminRoutes);
app.use("/services", serviceRoutes);
app.use("/country", countryRoutes);
app.use("/subscription", subscriptionRoutes);

// ✅ Connect to MongoDB and Start Server
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ Connected to MongoDB");

    // ✅ ✅ PUT THE INDEX FIX CODE HERE (BEFORE app.listen)
    try {
      const db = mongoose.connection.db;

      // your error shows: test.services -> collection is "services"
      const col = db.collection("services");

      const idx = await col.indexes();
      console.log("✅ services indexes:", idx.map((i) => i.name));

      if (idx.some((i) => i.name === "serviceContent.contentId_1")) {
        await col.dropIndex("serviceContent.contentId_1");
        console.log("✅ Dropped index: serviceContent.contentId_1");
      }

      if (idx.some((i) => i.name === "serviceContent.contentId_1_1")) {
        await col.dropIndex("serviceContent.contentId_1_1");
        console.log("✅ Dropped index: serviceContent.contentId_1_1");
      }

      // now sync indexes based on current schema
      const ServicesModel = require("./model/services");
      await ServicesModel.syncIndexes();
      console.log("✅ Services syncIndexes done");
    } catch (e) {
      console.log("⚠️ Index cleanup failed:", e.message);
    }

    // ✅ start server AFTER cleanup
    app.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

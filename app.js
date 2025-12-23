// app.js (or server.js)
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const cookieParser = require("cookie-parser");

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

// ✅ if behind nginx/vercel/proxy in production (needed for secure cookies)
app.set("trust proxy", 1);

// -----------------------------
// ✅ CORS (robust origin handling)
// -----------------------------
const defaultOrigins = [
  "https://liklet.com",
  "http://localhost:3000",
  "http://localhost:5173",
];

// FRONTEND_ORIGIN can be:
// 1) single origin: "http://localhost:3000"
// 2) comma separated: "http://localhost:3000,https://liklet.com"
const envOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = envOrigins.length ? envOrigins : defaultOrigins;

app.use(
  cors({
    origin: function (origin, cb) {
      // allow tools like Postman (no origin)
      if (!origin) return cb(null, true);

      if (allowedOrigins.includes(origin)) return cb(null, true);

      return cb(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
  })
);

// -----------------------------
// ✅ body parsing + cookies
// -----------------------------
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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

      const ServicesModel = require("./model/services");
      await ServicesModel.syncIndexes();
      console.log("✅ Services syncIndexes done");
    } catch (e) {
      console.log("⚠️ Index cleanup failed:", e.message);
    }

    // ✅ start server AFTER cleanup
    app.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
      console.log("✅ Allowed Origins:", allowedOrigins);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

module.exports = app;

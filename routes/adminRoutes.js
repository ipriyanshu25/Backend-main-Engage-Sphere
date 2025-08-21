// routes/adminRoutes.js
const express   = require('express');
const router    = express.Router();
const adminC    = require('../controller/adminController'); // keep your existing path
const adminAuth = require('../middleware/adminAuth');       // JWT-protected admin ops

// ── Auth ───────────────────────────────────────────────────────
router.post('/login', adminC.login);

// ── Password reset flow ────────────────────────────────────────
router.post('/forgot-password', adminC.forgotPassword);
router.post('/reset-password',  adminC.resetPassword);

// ── Email & password management ────────────────────────────────
// Direct email update (expects: adminId, newEmail)
router.post('/update-email', adminC.updateEmail);

// (Optional) Keep backward compatibility with your previous path:
router.post('/update-email/request', adminC.updateEmail);

// Update password (expects: adminId, oldPassword, newPassword)
router.post('/update-password', adminC.updatePassword);

// ── Admin-only operations ──────────────────────────────────────
// Update subscription adminStatus: 0 (in process) | 1 (completed)
router.post('/upStatus',  adminC.updateSubscriptionAdminStatus);

router.post('/tasks',adminC.listSubscriptions); // Get all subscriptions

module.exports = router;

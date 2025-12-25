const express = require('express');
const router = express.Router();
const uc = require('../controller/userController');
const adminOnly = require('../middleware/adminAuth');

// ─── OTP + Registration ──────────────────────────────────────────
// Step 1: request & email OTP
router.post('/request-otp', uc.requestOtpUser);

// Step 2: verify OTP only
router.post('/verify-otp', uc.verifyOtpUser);


router.post('/register', uc.registerUser);

// ─── Authentication ──────────────────────────────────────────────
// Login (must have completed registration / otpVerified)
router.post('/login', uc.loginUser);

// ─── Password Reset Flow ─────────────────────────────────────────
// 1. Request reset-OTP
router.post('/requestOtp', uc.requestPasswordReset);

// 2. Verify reset-OTP
router.post('/verifReset', uc.verifyPasswordResetOtp);

// 3. Submit new password
router.post('/updatePass', uc.resetPassword);

// ─── Public / Read routes ────────────────────────────────────────
// Get a user by ID
router.post('/getById', uc.getById);

// ─── Protected / Write routes ────────────────────────────────────
// Update profile (must be logged in)
router.post('/updateProfile', uc.verifyToken, uc.updateProfile);

// ─── Admin-only routes ───────────────────────────────────────────
// Simple flat list for dashboard
router.get('/all', uc.verifyToken, adminOnly, uc.getAllUsersSimple);

// Paginated search & sort
router.post('/getAll', uc.getAll);

router.post('/google', uc.googleSignIn);

router.post("/userlite", uc.verifyToken, uc.getUserLite);

router.post("/refresh-token", uc.refreshToken);
router.post("/logout", uc.logoutUser);

router.post("/requestEmailChangeOtp", uc.verifyToken, uc.requestEmailChangeOtp);
router.post("/verifyEmailChangeOtp", uc.verifyToken, uc.verifyEmailChangeOtp);



// ─── (Optional) direct lookup by param ──────────────────────────
// router.get('/:id', uc.verifyToken, adminOnly, uc.getById);

module.exports = router;

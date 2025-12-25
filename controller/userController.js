// controllers/userController.js
const jwt = require("jsonwebtoken");
const admin = require("../server/firebase"); // Ensure this path is correct
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const User = require("../model/user");
const VerifiedEmail = require("../model/VerifiedEmail");
const Country = require("../model/country");
const Subscription = require("../model/Subscription");

// -----------------------------
// 🌍 CONFIGURATION & CONSTANTS
// -----------------------------
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET env var is missing. Set it in your .env before starting the server."
  );
}

const IS_PROD = process.env.NODE_ENV === "production";
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15d";
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();

// Cookie Configuration
const cookieBase = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: COOKIE_SAMESITE,
};

const MS = { min: 60 * 1000, day: 24 * 60 * 60 * 1000 };
const ACCESS_COOKIE_MAX_AGE = Number(process.env.ACCESS_COOKIE_MAX_AGE_MS) || 15 * MS.min;
const REFRESH_COOKIE_MAX_AGE = Number(process.env.REFRESH_COOKIE_MAX_AGE_MS) || 7 * MS.day;

// -----------------------------
// 📧 EMAIL TEMPLATE & CONFIGURATION
// -----------------------------

// REPLACE THIS with your actual hosted logo URL (e.g. AWS S3, Cloudinary, or your public website)
const COMPANY_LOGO_URL = "https://liklet.com/favicon.ico"; 
const COMPANY_NAME = "LikLet";
const SUPPORT_LINK = "https://liklet.com/contact";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: +process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Generates a responsive HTML email template.
 * @param {string} title - The main heading
 * @param {string} message - The body text
 * @param {string} otp - The 6-digit code
 */
const getEmailTemplate = (title, message, otp) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
    .header { background: #0f172a; padding: 32px 0; text-align: center; }
    .logo-container { display: inline-flex; align-items: center; justify-content: center; background: white; border-radius: 12px; padding: 8px; }
    .logo { height: 40px; width: 40px; object-fit: contain; }
    .brand-name { color: white; font-size: 24px; font-weight: 700; margin-left: 12px; vertical-align: middle; display: inline-block; }
    .content { padding: 40px 32px; text-align: center; }
    .h1 { color: #1e293b; font-size: 24px; font-weight: 700; margin: 0 0 16px; }
    .p { color: #64748b; font-size: 16px; line-height: 24px; margin: 0 0 24px; }
    .otp-wrapper { margin: 32px 0; }
    .otp { background: #f1f5f9; color: #0f172a; font-size: 36px; font-weight: 800; letter-spacing: 8px; padding: 16px 32px; border-radius: 12px; border: 2px dashed #cbd5e1; display: inline-block; }
    .footer { background-color: #f1f5f9; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer-text { color: #94a3b8; font-size: 12px; margin: 0 0 8px; }
    .footer-link { color: #6366f1; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center">
             <div style="display:inline-block; vertical-align:middle;">
                <img src="${COMPANY_LOGO_URL}" alt="LikLet" width="32" height="32" style="display:block; border-radius: 6px;" />
             </div>
             <span style="color:#ffffff; font-size:22px; font-weight:bold; margin-left:10px; vertical-align:middle;">${COMPANY_NAME}</span>
          </td>
        </tr>
      </table>
    </div>
    <div class="content">
      <h1 class="h1">${title}</h1>
      <p class="p">${message}</p>
      
      <div class="otp-wrapper">
        <div class="otp">${otp}</div>
      </div>
      
      <p class="p" style="font-size: 14px; margin-top: 32px;">
        This code expires in <strong>10 minutes</strong>.<br>
        If you did not request this, please ignore this email.
      </p>
    </div>
    <div class="footer">
      <p class="footer-text">&copy; ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved.</p>
      <p class="footer-text">
        Need help? <a href="${SUPPORT_LINK}" class="footer-link">Contact Support</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Helper to send standardized OTP emails
 */
async function sendOtpEmail(toEmail, otp, type = "verification") {
  let subject = "";
  let title = "";
  let message = "";

  switch (type) {
    case "verification":
      subject = `${COMPANY_NAME} - Verify Your Email`;
      title = "Verify Your Email";
      message = `Welcome to ${COMPANY_NAME}! Please use the verification code below to verify your email address and complete your registration.`;
      break;
    case "password-reset":
      subject = `${COMPANY_NAME} - Password Reset Request`;
      title = "Reset Your Password";
      message = "We received a request to reset your password. Use the code below to verify your identity and set a new password.";
      break;
    case "email-change":
      subject = `${COMPANY_NAME} - Confirm Email Change`;
      title = "Confirm New Email";
      message = "You requested to update your email address. Please use the code below to verify this new email.";
      break;
    default:
      subject = `${COMPANY_NAME} - Your Verification Code`;
      title = "Verification Code";
      message = "Here is your one-time verification code.";
  }

  const htmlContent = getEmailTemplate(title, message, otp);

  await transporter.sendMail({
    from: `"${COMPANY_NAME}" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: subject,
    html: htmlContent,
  });
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// -----------------------------
// 🔐 JWT Helpers
// -----------------------------
function signAccessToken(userId) {
  return jwt.sign({ userId, type: "access" }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

function signRefreshToken(userId) {
  return jwt.sign({ userId, type: "refresh" }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie("accessToken", accessToken, { ...cookieBase, maxAge: ACCESS_COOKIE_MAX_AGE, path: "/" });
  res.cookie("refreshToken", refreshToken, { ...cookieBase, maxAge: REFRESH_COOKIE_MAX_AGE, path: "/user/refresh-token" });
}

function clearAuthCookies(res) {
  res.clearCookie("accessToken", { path: "/" });
  res.clearCookie("refreshToken", { path: "/user/refresh-token" });
}

// -----------------------------
// 🚀 API CONTROLLERS
// -----------------------------

/**
 * 1️⃣ Send OTP (Email-only, stored in VerifiedEmail collection)
 * POST /user/request-otp
 */
exports.requestOtpUser = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const normEmail = email.trim().toLowerCase();
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  try {
    await VerifiedEmail.findOneAndUpdate(
      { email: normEmail },
      {
        $set: {
          otpCode: code,
          otpExpiresAt: expiresAt,
          otpVerified: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Send styled HTML email
    await sendOtpEmail(normEmail, code, "verification");

    return res.json({ message: "OTP sent to email" });
  } catch (err) {
    console.error("requestOtpUser error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * 2️⃣ Verify OTP (marks email as verified in VerifiedEmail)
 * POST /user/verify-otp
 */
exports.verifyOtpUser = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  try {
    const doc = await VerifiedEmail.findOneAndUpdate(
      {
        email: email.trim().toLowerCase(),
        otpCode: otp.toString().trim(),
        otpExpiresAt: { $gt: new Date() },
      },
      {
        $set: { otpVerified: true },
        $unset: { otpCode: "", otpExpiresAt: "" },
      },
      { new: true }
    );

    if (!doc) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
    return res.json({ message: "OTP verified successfully" });
  } catch (err) {
    console.error("verifyOtpUser error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * 3️⃣ Registration (allowed ONLY if email is verified in VerifiedEmail)
 * POST /user/register
 */
exports.registerUser = async (req, res) => {
  const { email, name, password, phone, countryId, callingId, gender } = req.body;

  if (!email || !name || !password || !phone || !countryId || !callingId || gender == null) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const genderVal = Number(gender);
  if (![0, 1, 2].includes(genderVal)) {
    return res.status(400).json({ message: "gender must be 0=male, 1=female or 2=other" });
  }

  try {
    const normEmail = email.trim().toLowerCase();
    const normPhone = phone.trim();

    const verified = await VerifiedEmail.findOne({ email: normEmail });
    if (!verified || !verified.otpVerified) {
      return res.status(403).json({ message: "Email is not verified yet" });
    }

    const [byEmail, byPhone] = await Promise.all([
      User.findOne({ email: normEmail }),
      User.findOne({ phone: normPhone }),
    ]);
    if (byEmail) return res.status(409).json({ message: "Email already registered" });
    if (byPhone) return res.status(409).json({ message: "Phone already in use" });

    const [cd, callcd] = await Promise.all([
      Country.findById(countryId),
      Country.findById(callingId),
    ]);
    if (!cd || !callcd) {
      return res.status(400).json({ message: "Invalid countryId or callingId" });
    }

    const user = new User({
      name,
      email: normEmail,
      password,
      phone: normPhone,
      countryId,
      country: cd.countryName,
      callingId,
      callingcode: callcd.callingCode,
      gender: genderVal,
    });

    await user.save();

    return res.status(201).json({
      message: "User registered successfully",
      userId: user.userId,
    });
  } catch (err) {
    console.error("registerUser error:", err);
    if (err && err.code === 11000) {
      if (err.keyPattern?.email) return res.status(409).json({ message: "Email already registered" });
      if (err.keyPattern?.phone) return res.status(409).json({ message: "Phone already in use" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * 4️⃣ Login (email + password)
 * POST /user/login
 */
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });

    const accessToken = signAccessToken(user.userId);
    const refreshToken = signRefreshToken(user.userId);

    setAuthCookies(res, { accessToken, refreshToken });

    return res.json({
      message: "Login successful",
      token: accessToken, // backward compatibility
      userId: user.userId,
    });
  } catch (err) {
    console.error("loginUser error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * ✅ Refresh Access Token
 * POST /user/refresh-token
 */
exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token missing" });
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    if (!decoded || decoded.type !== "refresh" || !decoded.userId) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const user = await User.findOne({ userId: decoded.userId });
    if (!user) return res.status(401).json({ message: "User not found" });

    const newAccess = signAccessToken(user.userId);
    const newRefresh = signRefreshToken(user.userId);

    setAuthCookies(res, { accessToken: newAccess, refreshToken: newRefresh });

    return res.json({
      message: "Token refreshed",
      token: newAccess,
      userId: user.userId,
    });
  } catch (err) {
    console.error("refreshToken error:", err);
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }
};

/**
 * ✅ Logout (clears cookies)
 * POST /user/logout
 */
exports.logoutUser = async (req, res) => {
  clearAuthCookies(res);
  return res.json({ message: "Logged out" });
};

/**
 * Middleware to verify token
 */
exports.verifyToken = (req, res, next) => {
  try {
    let token = null;

    // 1) Prefer Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(" ");
      token = parts.length === 2 ? parts[1] : authHeader;
    }

    // 2) Fallback to cookie
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) return res.status(403).json({ message: "Token required" });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded?.userId) return res.status(403).json({ message: "Invalid token" });

    req.user = { userId: decoded.userId };
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

/**
 * Get paginated users
 * POST /user/getAll
 */
exports.getAll = async (req, res) => {
  try {
    let { page = 1, limit = 10, search = "", sortBy = "createdAt", sortOrder = "desc" } = req.body;

    page = Math.max(1, parseInt(page));
    limit = Math.max(1, parseInt(limit));

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const sort = { [sortBy]: sortOrder.toLowerCase() === "asc" ? 1 : -1 };

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-password -__v");

    return res.status(200).json({
      data: users,
      meta: { total, page, perPage: limit, lastPage: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("GetAll users error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get all users (flat array)
 * GET /user/all
 */
exports.getAllUsersSimple = async (req, res) => {
  try {
    const users = await User.find()
      .select("userId name email phone role isActive createdAt")
      .sort({ createdAt: -1 });

    return res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching all users:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Update user profile
 * POST /user/update
 */
exports.updateProfile = async (req, res) => {
  try {
    const { userId, name, phone, country, callingcode, gender, socialMedia, email } = req.body;

    if (!userId) return res.status(400).json({ error: "userId is required" });

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ error: "User not found" });

    // socialMedia sanitize
    const allowed = new Set(["instagram", "youtube", "linkedin"]);
    const cleanedSocial = Array.isArray(socialMedia)
      ? socialMedia
          .filter((x) => x && allowed.has(x.platform))
          .map((x) => ({
            platform: x.platform,
            url: String(x.url || "").trim(),
          }))
          .filter((x) => x.url)
      : [];

    // Email update logic
    if (email !== undefined) {
      const newEmail = String(email).trim().toLowerCase();

      if (newEmail && newEmail !== user.email) {
        if (
          !user.pendingEmail ||
          user.pendingEmail !== newEmail ||
          !user.emailChangeVerified ||
          !user.emailChangeExpiresAt ||
          new Date(user.emailChangeExpiresAt).getTime() < Date.now()
        ) {
          return res.status(400).json({
            error: "Please verify OTP for the new email before updating.",
          });
        }

        const exists = await User.findOne({ email: newEmail, userId: { $ne: userId } });
        if (exists) {
          return res.status(400).json({ error: "Email already in use" });
        }

        user.email = newEmail;
        user.emailVerified = true;
        user.pendingEmail = undefined;
        user.emailChangeCodeHash = undefined;
        user.emailChangeExpiresAt = undefined;
        user.emailChangeVerified = false;
      }
    }

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (country !== undefined) user.country = country;
    if (callingcode !== undefined) user.callingcode = callingcode;
    if (gender !== undefined) user.gender = gender;

    user.socialMedia = cleanedSocial;

    await user.save();

    return res.json({ data: user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
};

/**
 * Get user by userId + subscription stats
 * POST /user/getById
 */
exports.getById = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId is required" });

    const user = await User.findOne({ userId }).select("-password -__v");
    if (!user) return res.status(404).json({ message: "User not found" });

    const [totalSubs, activeSubs, completedSubs] = await Promise.all([
      Subscription.countDocuments({ userId }),
      Subscription.countDocuments({ userId, Status: 0 }),
      Subscription.countDocuments({ userId, Status: 1 }),
    ]);

    return res.status(200).json({
      data: user,
      subscriptions: { total: totalSubs, active: activeSubs, completed: completedSubs },
    });
  } catch (err) {
    console.error("Get user by ID error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Password reset: request OTP
 * POST /user/password-reset/request
 */
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const normEmail = email.trim().toLowerCase();
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    const user = await User.findOneAndUpdate(
      { email: normEmail },
      {
        $set: {
          passwordResetCode: code,
          passwordResetExpiresAt: expiresAt,
          passwordResetVerified: false,
        },
      },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "No user with that email" });

    // Send HTML Email
    await sendOtpEmail(normEmail, code, "password-reset");

    return res.json({ message: "Reset OTP sent to email" });
  } catch (err) {
    console.error("requestPasswordReset error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Password reset: verify OTP
 * POST /user/password-reset/verify
 */
exports.verifyPasswordResetOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });

  try {
    const user = await User.findOneAndUpdate(
      {
        email: email.trim().toLowerCase(),
        passwordResetCode: otp.toString().trim(),
        passwordResetExpiresAt: { $gt: new Date() },
      },
      {
        $set: { passwordResetVerified: true },
        $unset: { passwordResetCode: "", passwordResetExpiresAt: "" },
      },
      { new: true }
    );

    if (!user) return res.status(400).json({ message: "Invalid or expired OTP" });
    return res.json({ message: "OTP verified, you may now reset your password" });
  } catch (err) {
    console.error("verifyPasswordResetOtp error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Password reset: set new password
 * POST /user/password-reset/reset
 */
exports.resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ message: "Email and newPassword are required" });
  }

  try {
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      passwordResetVerified: true,
    });
    if (!user) return res.status(403).json({ message: "OTP not verified or invalid email" });

    user.password = newPassword;
    user.passwordResetVerified = false;
    await user.save();

    return res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Google Sign In
 */
exports.googleSignIn = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "token is required" });

    // Use native 'fetch'
    const googleResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      console.error("Google API Error:", errorText);
      return res.status(401).json({ message: "Invalid Google Access Token" });
    }

    const googleUser = await googleResponse.json();
    const { sub: uid, email, email_verified: emailVerified, name, picture } = googleUser;

    if (!email) return res.status(400).json({ message: "Google account has no email" });

    const normEmail = email.trim().toLowerCase();
    let user = await User.findOne({ email: normEmail });

    if (!user) {
      user = new User({
        authProvider: "google",
        googleUid: uid,
        email: normEmail,
        name: name || normEmail.split("@")[0],
        picture,
        emailVerified: !!emailVerified,
        phone: undefined,
        countryId: undefined,
        callingId: undefined,
        country: "Unknown",
        callingcode: "0",
        gender: 2,
      });
      await user.save({ validateBeforeSave: false });
    } else {
      const updates = {};
      if (!user.googleUid) updates.googleUid = uid;
      if (typeof emailVerified === "boolean") updates.emailVerified = emailVerified;
      if (picture && !user.picture) updates.picture = picture;
      if (user.authProvider !== "google") updates.authProvider = "google";

      if (Object.keys(updates).length > 0) {
        await User.updateOne({ _id: user._id }, { $set: updates });
        user = await User.findById(user._id);
      }
    }

    const accessToken = signAccessToken(user.userId);
    const refreshToken = signRefreshToken(user.userId);
    setAuthCookies(res, { accessToken, refreshToken });

    const safeUser = {
      id: user.userId,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      countryId: user.countryId || "",
      callingId: user.callingId || "",
      gender: typeof user.gender === "number" ? String(user.gender) : "",
      createdAt: user.createdAt,
      picture: user.picture || "",
      emailVerified: !!user.emailVerified,
      authProvider: user.authProvider,
    };

    return res.json({
      message: "Login successful",
      token: accessToken,
      userId: user.userId,
      user: safeUser,
    });
  } catch (err) {
    console.error("googleSignIn error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get User Lite
 */
exports.getUserLite = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId is required" });

    const user = await User.findOne({ userId }).select("userId name email country").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json({
      data: {
        userId: user.userId,
        name: user.name || "",
        email: user.email || "",
        country: user.country || "",
      },
    });
  } catch (err) {
    console.error("getUserLite error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Request Email Change OTP
 */
exports.requestEmailChangeOtp = async (req, res) => {
  try {
    const { userId, newEmail } = req.body;
    if (!userId || !newEmail) {
      return res.status(400).json({ error: "userId and newEmail are required" });
    }

    const email = String(newEmail).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.email === email) {
      return res.status(400).json({ error: "New email is same as current email" });
    }

    const exists = await User.findOne({ email, userId: { $ne: userId } });
    if (exists) return res.status(400).json({ error: "Email already in use" });

    const otp = generateOtp();
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(otp, salt);

    user.pendingEmail = email;
    user.emailChangeCodeHash = hash;
    user.emailChangeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    user.emailChangeVerified = false;
    await user.save();

    // Send HTML Email
    await sendOtpEmail(email, otp, "email-change");

    return res.json({ message: "OTP sent to new email" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
};

/**
 * Verify Email Change OTP
 */
exports.verifyEmailChangeOtp = async (req, res) => {
  try {
    const { userId, otp } = req.body;
    if (!userId || !otp) {
      return res.status(400).json({ error: "userId and otp are required" });
    }

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.pendingEmail || !user.emailChangeCodeHash || !user.emailChangeExpiresAt) {
      return res.status(400).json({ error: "No pending email verification request" });
    }

    if (new Date(user.emailChangeExpiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: "OTP expired. Please request again." });
    }

    const ok = await bcrypt.compare(String(otp).trim(), user.emailChangeCodeHash);
    if (!ok) return res.status(400).json({ error: "Invalid OTP" });

    user.emailChangeVerified = true;
    await user.save();

    return res.json({ message: "Email OTP verified" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to verify OTP" });
  }
};
// controllers/userController.js
const jwt           = require('jsonwebtoken');
const admin = require('../server/firebase');
const nodemailer    = require('nodemailer');
const User          = require('../model/user');
const VerifiedEmail = require('../model/VerifiedEmail');
const Country       = require('../model/country');
const Subscription  = require('../model/Subscription');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET env var is missing. Set it in your .env before starting the server.');
}

// SMTP transporter (fill in your .env)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: +process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * 1️⃣ Send OTP (Email-only, stored in VerifiedEmail collection)
 * POST /user/request-otp
 * body: { email }
 */
exports.requestOtpUser = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  const normEmail = email.trim().toLowerCase();
  const code      = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    await VerifiedEmail.findOneAndUpdate(
      { email: normEmail },
      {
        $set: {
          otpCode: code,
          otpExpiresAt: expiresAt,
          otpVerified: false
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await transporter.sendMail({
      from: `"No-Reply" <${process.env.SMTP_USER}>`,
      to: normEmail,
      subject: 'Your Verification Code',
      text: `Your code is ${code}. It expires in 10 minutes.`
    });

    return res.json({ message: 'OTP sent to email' });
  } catch (err) {
    console.error('requestOtpUser error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * 2️⃣ Verify OTP (marks email as verified in VerifiedEmail)
 * POST /user/verify-otp
 * body: { email, otp }
 */
exports.verifyOtpUser = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  try {
    const doc = await VerifiedEmail.findOneAndUpdate(
      {
        email: email.trim().toLowerCase(),
        otpCode: otp.toString().trim(),
        otpExpiresAt: { $gt: new Date() }
      },
      {
        $set: { otpVerified: true },
        $unset: { otpCode: "", otpExpiresAt: "" }
      },
      { new: true }
    );

    if (!doc) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    return res.json({ message: 'OTP verified successfully' });
  } catch (err) {
    console.error('verifyOtpUser error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * 3️⃣ Registration (allowed ONLY if email is verified in VerifiedEmail)
 * POST /user/register
 * body: { email, name, password, phone, countryId, callingId, gender }
 */
exports.registerUser = async (req, res) => {
  const {
    email,
    name,
    password,
    phone,
    countryId,
    callingId,
    gender
  } = req.body;

  if (!email || !name || !password || !phone || !countryId || !callingId || gender == null) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const genderVal = Number(gender);
  if (![0,1,2].includes(genderVal)) {
    return res.status(400).json({ message: 'gender must be 0=male, 1=female or 2=other' });
  }

  try {
    const normEmail = email.trim().toLowerCase();
    const normPhone = phone.trim();

    // must be verified in VerifiedEmail
    const verified = await VerifiedEmail.findOne({ email: normEmail });
    if (!verified || !verified.otpVerified) {
      return res.status(403).json({ message: 'Email is not verified yet' });
    }

    // ensure unique email & phone (app-level checks; DB enforces too)
    const [byEmail, byPhone] = await Promise.all([
      User.findOne({ email: normEmail }),
      User.findOne({ phone: normPhone })
    ]);
    if (byEmail) return res.status(409).json({ message: 'Email already registered' });
    if (byPhone) return res.status(409).json({ message: 'Phone already in use' });

    // lookup countries
    const [cd, callcd] = await Promise.all([
      Country.findById(countryId),
      Country.findById(callingId)
    ]);
    if (!cd || !callcd) {
      return res.status(400).json({ message: 'Invalid countryId or callingId' });
    }

    // create the user
    const user = new User({
      name,
      email: normEmail,
      password,                // will be hashed by pre-save hook
      phone: normPhone,
      countryId,
      country: cd.countryName,
      callingId,
      callingcode: callcd.callingCode,
      gender: genderVal
    });

    await user.save();

    return res.status(201).json({
      message: 'User registered successfully',
      userId: user.userId
    });
  } catch (err) {
    console.error('registerUser error:', err);
    if (err && err.code === 11000) {
      if (err.keyPattern?.email) return res.status(409).json({ message: 'Email already registered' });
      if (err.keyPattern?.phone) return res.status(409).json({ message: 'Phone already in use' });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * 4️⃣ Login (email + password)
 * POST /user/login
 * body: { email, password }
 */
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const ok = await user.comparePassword(password);
    if (!ok) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.userId }, JWT_SECRET, { expiresIn: '100d' });
    return res.json({ message: 'Login successful', token, userId: user.userId });
  } catch (err) {
    console.error('loginUser error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Middleware to verify token
 */
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(403).json({ message: 'Token required' });

  const parts = authHeader.split(' ');
  const token = parts.length === 2 ? parts[1] : authHeader;

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err)
      return res.status(403).json({ message: 'Invalid or expired token' });

    req.user = { userId: decoded.userId };
    next();
  });
};

/**
 * Get paginated users with search/sort (optional)
 * POST /user/getAll
 * body: { page, limit, search, sortBy, sortOrder }
 */
exports.getAll = async (req, res) => {
  try {
    let { page = 1, limit = 10, search = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.body;

    page = Math.max(1, parseInt(page));
    limit = Math.max(1, parseInt(limit));

    const filter = {};
    if (search) {
      filter.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const sort = { [sortBy]: sortOrder.toLowerCase() === 'asc' ? 1 : -1 };

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-password -__v');

    return res.status(200).json({
      data: users,
      meta: {
        total,
        page,
        perPage: limit,
        lastPage: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('GetAll users error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get all users (flat array, for Admin Dashboard)
 * GET /user/all
 */
exports.getAllUsersSimple = async (req, res) => {
  try {
    const users = await User.find()
      .select('userId name email phone role isActive createdAt')
      .sort({ createdAt: -1 });

    return res.status(200).json(users);
  } catch (err) {
    console.error('Error fetching all users:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Update user profile
 * POST /user/update
 * body: { userId, name?, phone?, oldPassword?, newPassword? }
 */
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, oldPassword, newPassword, userId } = req.body;

    const user = await User.findOne({ userId });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (phone) user.phone = phone.trim();

    if (newPassword) {
      if (!oldPassword) {
        return res.status(400).json({ message: 'Old password is required' });
      }
      const isMatch = await user.comparePassword(oldPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Old password is incorrect' });
      }
      user.password = newPassword;
    }

    await user.save();

    const safeUser = {
      id: user.userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt
    };

    return res.status(200).json({ message: 'Profile updated', user: safeUser });
  } catch (err) {
    console.error('UpdateProfile error:', err);
    if (err && err.code === 11000 && err.keyPattern?.phone) {
      return res.status(409).json({ message: 'Phone already in use' });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get user by userId + subscription stats
 * POST /user/getById
 * body: { userId }
 */
exports.getById = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const user = await User.findOne({ userId }).select('-password -__v');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // subscription counts (admin Status: 0=in process, 1=completed)
    const [totalSubs, activeSubs, completedSubs] = await Promise.all([
      Subscription.countDocuments({ userId }),
      Subscription.countDocuments({ userId, Status: 0 }),
      Subscription.countDocuments({ userId, Status: 1 })
    ]);

    return res.status(200).json({
      data: user,
      subscriptions: {
        total: totalSubs,
        active: activeSubs,
        completed: completedSubs
      }
    });
  } catch (err) {
    console.error('Get user by ID error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Password reset: request OTP
 * POST /user/password-reset/request
 * body: { email }
 */
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  const normEmail = email.trim().toLowerCase();
  const code      = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    const user = await User.findOneAndUpdate(
      { email: normEmail },
      {
        $set: {
          passwordResetCode: code,
          passwordResetExpiresAt: expiresAt,
          passwordResetVerified: false
        }
      },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ message: 'No user with that email' });
    }

    await transporter.sendMail({
      from: `"No-Reply" <${process.env.SMTP_USER}>`,
      to: normEmail,
      subject: 'Your Password Reset Code',
      text: `Your reset code is ${code}. It expires in 10 minutes.`
    });

    return res.json({ message: 'Reset OTP sent to email' });
  } catch (err) {
    console.error('requestPasswordReset error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Password reset: verify OTP
 * POST /user/password-reset/verify
 * body: { email, otp }
 */
exports.verifyPasswordResetOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  try {
    const user = await User.findOneAndUpdate(
      {
        email: email.trim().toLowerCase(),
        passwordResetCode: otp.toString().trim(),
        passwordResetExpiresAt: { $gt: new Date() }
      },
      {
        $set: { passwordResetVerified: true },
        $unset: { passwordResetCode: "", passwordResetExpiresAt: "" }
      },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    return res.json({ message: 'OTP verified, you may now reset your password' });
  } catch (err) {
    console.error('verifyPasswordResetOtp error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Password reset: set new password
 * POST /user/password-reset/reset
 * body: { email, newPassword }
 */
exports.resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ message: 'Email and newPassword are required' });
  }

  try {
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      passwordResetVerified: true
    });
    if (!user) {
      return res.status(403).json({ message: 'OTP not verified or invalid email' });
    }

    user.password              = newPassword;   // will be hashed
    user.passwordResetVerified = false;         // clear the flag
    await user.save();

    return res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};




exports.googleSignIn = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: 'idToken is required' });

    const decoded = await admin.auth().verifyIdToken(idToken);
    // decoded contains: uid, email, email_verified, name, picture, etc.
    const {
      uid,
      email,
      email_verified: emailVerified,
      name,
      picture,
    } = decoded;

    if (!email) {
      return res.status(400).json({ message: 'Google account has no email' });
    }

    const normEmail = email.trim().toLowerCase();

    // Find by email (single-account policy)
    let user = await User.findOne({ email: normEmail });

    if (!user) {
      // Create minimal google user; local-only required fields are conditionally skipped
      user = new User({
        authProvider: 'google',
        googleUid: uid,
        email: normEmail,
        name: name || normEmail.split('@')[0],
        picture,
        emailVerified: !!emailVerified,
      });
      await user.save();
    } else {
      // Update metadata if changed; do NOT override local profile data
      const updates = {};
      if (!user.googleUid) updates.googleUid = uid;
      if (typeof emailVerified === 'boolean') updates.emailVerified = emailVerified;
      if (picture && !user.picture) updates.picture = picture;
      if (name && !user.name) updates.name = name;
      if (user.authProvider !== 'google') updates.authProvider = user.authProvider || 'google'; // keep existing if local

      if (Object.keys(updates).length) {
        await User.updateOne({ _id: user._id }, { $set: updates });
        user = await User.findById(user._id);
      }
    }

    // Issue your app JWT
    const token = jwt.sign({ userId: user.userId }, process.env.JWT_SECRET, { expiresIn: '100d' });

    const safeUser = {
      id        : user.userId,
      name      : user.name,
      email     : user.email,
      phone     : user.phone || '',
      countryId : user.countryId || '',
      callingId : user.callingId || '',
      gender    : typeof user.gender === 'number' ? String(user.gender) : '',
      createdAt : user.createdAt,
      picture   : user.picture || '',
      emailVerified: !!user.emailVerified,
      authProvider : user.authProvider,
    };

    return res.json({ message: 'Login successful', token, userId: user.userId, user: safeUser });
  } catch (err) {
    console.error('googleSignIn error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
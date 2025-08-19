// controllers/userController.js
const jwt       = require('jsonwebtoken');
const mongoose = require('mongoose');
const nodemailer= require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const User      = require('../model/user');
const Country   = require('../model/country');
const Subscription = require('../model/Subscription');
const JWT_SECRET= process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET env var is missing. Set it in your .env before starting the server.');
}

// SMTP transporter (fill in your .env)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: +process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE==='true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * 1️⃣ Send OTP (upsert email-only record, inject userId default)
 */
exports.requestOtpUser = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  const code      = Math.floor(100000 + Math.random()*900000).toString();
  const expiresAt = new Date(Date.now() + 10*60*1000);

  try {
    await User.findOneAndUpdate(
      { email: email.trim().toLowerCase() },
      {
        $set: {
          otpCode:code,
          otpExpiresAt: expiresAt,
          otpVerified: false
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    await transporter.sendMail({
      from: `"No-Reply" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your Verification Code',
      text: `Your code is ${code}. It expires in 10 minutes.`
    });

    res.json({ message: 'OTP sent to email' });
  } catch (err) {
    console.error('requestOtpUser error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * 2️⃣ Verify OTP only
 */
exports.verifyOtpUser = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and otp are required' });
  }

  try {
    const user = await User.findOneAndUpdate(
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

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    res.json({ message: 'OTP verified successfully' });
  } catch (err) {
    console.error('verifyOtpUser error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * 3️⃣ Complete registration (after OTP verified)
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

  // required‐field check
  if (!email || !name || !password || !phone || !countryId || !callingId || gender==null) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const genderVal = Number(gender);
  if (![0,1,2].includes(genderVal)) {
    return res.status(400).json({
      message: 'gender must be 0=male,1=female or2=other'
    });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user)           return res.status(404).json({ message: 'No OTP found' });
    if (!user.otpVerified) return res.status(403).json({ message: 'OTP not verified' });
    if (user.name)       return res.status(400).json({ message: 'Already registered' });

    // ensure phone unique
    const dup = await User.findOne({ phone: phone.trim() });
    if (dup && dup.email !== user.email) {
      return res.status(409).json({ message: 'Phone already in use' });
    }

    // lookup countries
    const [ cd, callcd ] = await Promise.all([
      Country.findById(countryId),
      Country.findById(callingId)
    ]);
    if (!cd || !callcd) {
      return res.status(400).json({ message: 'Invalid countryId or callingId' });
    }

    // apply profile
    user.name        = name;
    user.password    = password;          // will be hashed
    user.phone       = phone.trim();
    user.countryId   = countryId;
    user.country     = cd.countryName;    // correct field
    user.callingId   = callingId;
    user.callingcode = callcd.callingCode;
    user.gender      = genderVal;

    await user.save();
    res.status(201).json({
      message: 'User registered successfully',
      userId: user.userId
    });
  } catch (err) {
    console.error('registerUser error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * 4️⃣ Login (only if otpVerified & registered)
 */
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  if (!email||!password) {
    return res.status(400).json({ message: 'Email and password required' });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !user.otpVerified) {
      return res.status(403).json({ message: 'Please verify email first' });
    }
    if (!(await user.comparePassword(password))) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.userId }, JWT_SECRET, {
      expiresIn: '100d'
    });
    res.json({ message: 'Login successful', token, userId: user.userId });
  } catch (err) {
    console.error('loginUser error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Middleware to verify token
 */
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(403).json({ message: 'Token required' });

  const token = authHeader.split(' ')[1];

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
 */
exports.getAll = async (req, res) => {
  try {
    let { page = 1, limit = 10, search = '', sortBy = 'createdAt', sortOrder = 'desc' } = req.body;

    page = Math.max(1, parseInt(page));
    limit = Math.max(1, parseInt(limit));

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const sort = {
      [sortBy]: sortOrder.toLowerCase() === 'asc' ? 1 : -1,
    };

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
        lastPage: Math.ceil(total / limit),
      },
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
      .select('name email phone role isActive createdAt')
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
 */
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, oldPassword, newPassword ,userId} = req.body;

    const user = await User.findOne({ userId });
    if (!user)
      return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (phone) user.phone = phone;

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
      createdAt: user.createdAt,
    };

    return res.status(200).json({ message: 'Profile updated', user: safeUser });
  } catch (err) {
    console.error('UpdateProfile error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


exports.getById = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    // find the user, omit password and __v
    const user = await User.findOne({ userId }).select('-password -__v');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // subscription counts (admin Status: 0=in process, 1=completed)
    const [totalSubs, activeSubs, completedSubs] = await Promise.all([
      Subscription.countDocuments({ userId }),
      Subscription.countDocuments({ userId, Status: 0 }),
      Subscription.countDocuments({ userId, Status: 1 }),
    ]);

    return res.status(200).json({
      data: user,
      subscriptions: {
        total: totalSubs,
        active: activeSubs,       // Status === 0
        completed: completedSubs, // Status === 1
      },
    });
  } catch (err) {
    console.error('Get user by ID error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  const code      = Math.floor(100000 + Math.random()*900000).toString();
  const expiresAt = new Date(Date.now() + 10*60*1000);

  try {
    const user = await User.findOneAndUpdate(
      { email: email.trim().toLowerCase() },
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
      to: email,
      subject: 'Your Password Reset Code',
      text: `Your reset code is ${code}. It expires in 10 minutes.`
    });

    res.json({ message: 'Reset OTP sent to email' });
  } catch (err) {
    console.error('requestPasswordReset error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * 2️⃣ verifyPasswordResetOtp
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
    res.json({ message: 'OTP verified, you may now reset your password' });
  } catch (err) {
    console.error('verifyPasswordResetOtp error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * 3️⃣ resetPassword
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

    user.password              = newPassword;   // will get hashed
    user.passwordResetVerified = false;        // clear the flag
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};


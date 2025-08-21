
// controllers/adminController.js


const Admin     = require('../model/admin');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const crypto    = require('crypto');
const nodemailer= require('nodemailer');
const Subscription  = require('../model/Subscription');



// configure SMTP transporter (for password reset OTPs)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  }
});

async function sendOtp(email, subject, otp) {
  await transporter.sendMail({
    from: `"No Reply" <${process.env.SMTP_USER}>`,
    to: email,
    subject,
    text: `Your OTP code is ${otp}. It expires in 10 minutes.`
  });
}

// ==== 1️⃣ Email Update – direct change ====
exports.updateEmail = async (req, res) => {
  const { adminId, newEmail } = req.body;
  if (!adminId || !newEmail) {
    return res.status(400).json({ message: 'adminId and newEmail are required' });
  }
  try {
    const admin = await Admin.findOne({ adminId });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    admin.email = newEmail;
    await admin.save();

    const payload = { adminId: admin.adminId, email: admin.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Email updated successfully', email: admin.email, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ==== 2️⃣ Password Update – verify old password, set new password ====
exports.updatePassword = async (req, res) => {
  const { adminId, oldPassword, newPassword } = req.body;
  if (!adminId || !oldPassword || !newPassword) {
    return res.status(400).json({ message: 'adminId, oldPassword, and newPassword are required' });
  }
  try {
    const admin = await Admin.findOne({ adminId });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    const match = admin &&
      (admin.password.startsWith('$2')
        ? await bcrypt.compare(oldPassword, admin.password)
        : oldPassword === admin.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    await admin.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ==== 3️⃣ Login – simplified with fallback for plain text passwords ====
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    // normalize email input
    const emailNorm = email.trim().toLowerCase();
    const admin = await Admin.findOne({ email: emailNorm });
    // support bcrypt hashed or plain passwords
    const isMatch = admin &&
      (admin.password.startsWith('$2')
        ? await bcrypt.compare(password, admin.password)
        : password === admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const payload = { adminId: admin.adminId, email: admin.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, adminId: admin.adminId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ==== 4️⃣ Forgot password – request reset OTP ====
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const admin = await Admin.findOne({ email: email.trim().toLowerCase() });
    if (!admin) return res.status(404).json({ message: 'Email not found' });

    const otp = crypto.randomInt(100000, 999999).toString();
    admin.resetOtp = { code: otp, expires: Date.now() + 600000 };
    await admin.save();
    await sendOtp(email, 'Your password reset OTP', otp);

    res.json({ message: 'Reset OTP sent to email' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ==== 5️⃣ Verify reset OTP & update password ====
exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    const admin = await Admin.findOne({ email: email.trim().toLowerCase() });
    if (!admin || !admin.resetOtp?.code) {
      return res.status(400).json({ message: 'No reset requested for this email' });
    }
    if (Date.now() > admin.resetOtp.expires || otp !== admin.resetOtp.code) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    admin.resetOtp = undefined;
    await admin.save();

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};




exports.updateSubscriptionAdminStatus = async (req, res) => {
  try {
    const { subscriptionId, Status } = req.body;
    if (!subscriptionId || (Status !== 0 && Status !== 1)) {
      return res.status(400).json({ message: 'subscriptionId and Status (0 or 1) are required' });
    }
    const sub = await Subscription.findOneAndUpdate(
      { subscriptionId },
      { Status },
      { new: true }
    );
    if (!sub) return res.status(404).json({ message: 'Subscription not found' });
    return res.json({ message: 'Status updated', subscription: sub });
  } catch (err) {
    console.error('updateSubscriptionStatus error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};


exports.listSubscriptions = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',   // default: latest first by createdAt
      sortOrder = 'desc',     // 'asc' or 'desc'
      Status,                 // optional filter: 0 or 1
      q                       // optional text search across a few fields
    } = req.body || {};

    // sanitize numbers
    page = Math.max(parseInt(page, 10) || 1, 1);
    limit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

    // build filter
    const filter = {};
    if (Status === 0 || Status === 1 || Status === '0' || Status === '1') {
      filter.Status = Number(Status);
    }

    // simple text search (adjust fields to your schema)
    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim(), 'i');
      filter.$or = [
        { subscriptionId: rx },
        { email: rx },
        { userId: rx },
        { planName: rx }
      ];
    }

    // sort: latest on top by default (+ _id tiebreaker)
    const sort = {};
    sort[sortBy] = String(sortOrder).toLowerCase() === 'asc' ? 1 : -1;
    if (!sort._id) sort._id = -1;

    const skip = (page - 1) * limit;

    // --- Aggregation pipeline: match, sort, page, then lookup plan+pricing by pricingId ---
    const pipeline = [
      { $match: filter },

      // sorting + paging
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },

      // join with plans to extract the single pricing subdocument matching subscription.pricingId
      {
        $lookup: {
          from: 'plans', // Mongoose pluralizes 'Plan' -> 'plans'
          let: {
            pricingId: '$pricingId',
            subPlanId: '$planId' // optional: if your Subscription stores planId (uuid)
          },
          pipeline: [
            {
              // If we have planId on the subscription, ensure the plan matches AND contains the pricingId.
              // Otherwise, match any plan that contains the pricingId.
              $match: {
                $expr: {
                  $cond: [
                    { $gt: [{ $ifNull: ['$$subPlanId', ''] }, ''] },
                    {
                      $and: [
                        { $eq: ['$planId', '$$subPlanId'] },
                        { $in: ['$$pricingId', '$pricing.pricingId'] }
                      ]
                    },
                    { $in: ['$$pricingId', '$pricing.pricingId'] }
                  ]
                }
              }
            },
            {
              // keep only the one pricing entry we care about
              $project: {
                planId: 1,
                name: 1,
                status: 1,
                pricing: {
                  $filter: {
                    input: '$pricing',
                    as: 'p',
                    cond: { $eq: ['$$p.pricingId', '$$pricingId'] }
                  }
                }
              }
            },
            // unwrap the single matched pricing (if any)
            { $unwind: { path: '$pricing', preserveNullAndEmptyArrays: true } }
          ],
          as: 'planJoin'
        }
      },
      { $unwind: { path: '$planJoin', preserveNullAndEmptyArrays: true } },

      // shape final output: attach plan + pricing; keep existing planName if you already store it
      {
        $addFields: {
          plan: {
            planId: '$planJoin.planId',
            name: '$planJoin.name',
            status: '$planJoin.status'
          },
          pricing: '$planJoin.pricing',
          // if you don't store planName on subscription, this ensures it's present
          planName: { $ifNull: ['$planName', '$planJoin.name'] }
        }
      },
      { $project: { planJoin: 0 } }
    ];

    const [data, total] = await Promise.all([
      Subscription.aggregate(pipeline).exec(),
      Subscription.countDocuments(filter)
    ]);

    return res.json({
      message: 'Subscriptions fetched',
      paging: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      },
      data
    });
  } catch (err) {
    console.error('listSubscriptions error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
// middleware/adminAuth.js
const jwt   = require('jsonwebtoken');
const Admin = require('../model/admin');

module.exports = async function adminAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Missing admin token' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findOne({ adminId: payload.adminId, email: payload.email });
    if (!admin) return res.status(401).json({ message: 'Invalid admin token' });

    req.admin = { adminId: admin.adminId, email: admin.email };
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

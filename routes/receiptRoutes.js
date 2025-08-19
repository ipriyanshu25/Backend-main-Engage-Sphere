// routes/receiptRoutes.js
const express = require('express');
const { verifyToken } = require('../controller/userController');
const { generateReceipt, viewReceipt } = require('../controller/receiptController');

const router = express.Router();

// POST /api/receipt/generate
// Accepts JSON body: { orderId }
router.post(
  '/generate',
  verifyToken,
  generateReceipt
);

// POST /api/receipt/view
// Accepts JSON body: { receiptId }
router.post(
  '/view',
  verifyToken,
  viewReceipt
);

module.exports = router;

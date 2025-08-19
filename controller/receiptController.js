// controllers/receiptController.js
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const User = require('../model/user');
const Payment = require('../model/payment');
const Receipt = require('../model/receipt');

/**
 * Helper: format currency
 */
function formatCurrency(amount, currency) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

/**
 * Generate a professional PDF receipt via POST, store a Receipt record, and return PDF stream with X-Receipt-Id header.
 */
exports.generateReceipt = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ message: 'orderId is required' });
    }

    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const user = await User.findById(payment.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Store receipt metadata
    const receiptRecord = await Receipt.create({
      orderId: payment.orderId,
      transactionId: payment.transactionId,
      userId: payment.userId,
      payerName: payment.payerName,
      payerEmail: payment.payerEmail,
      packageName: payment.packageName,
      packageFeatures: payment.packageFeatures,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      create_time: payment.create_time,
    });

    // Set PDF headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Receipt_${receiptRecord.receiptId}.pdf`);
    res.setHeader('X-Receipt-Id', receiptRecord.receiptId);

    // Initialize PDF document
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    // === Header with logo and title ===
    const logoPath = path.join(__dirname, '../assets/logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 45, { width: 100 });
    }
    doc.font('Helvetica-Bold').fontSize(20).text('EngageSphere', 0, 50, { align: 'right' }).moveDown(0.5);
    doc.strokeColor('#eeeeee').moveTo(50, 110).lineTo(545, 110).stroke();

    // === Customer & Transaction Info ===
    const infoTop = 130;
    doc.fontSize(10).font('Helvetica')
      .text(`Receipt ID: ${receiptRecord.receiptId}`, 50, infoTop)
      .text(`Order ID: ${payment.orderId}`, 50, infoTop + 15)
      .text(`Date: ${new Date(payment.create_time).toLocaleString()}`, 50, infoTop + 30);
    doc.text(`Bill To:`, 350, infoTop)
      .text(user.name, 350, infoTop + 15)
      .text(user.email, 350, infoTop + 30)
      .text(user.address, 350, infoTop + 45);

    // === Table Header ===
    const tableTop = infoTop + 80;
    doc.font('Helvetica-Bold').fontSize(12)
      .text('Description', 50, tableTop)
      .text('Amount', 450, tableTop, { width: 90, align: 'right' });
    doc.strokeColor('#cccccc').moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

    // === Table Rows ===
    let rowY = tableTop + 25;
    doc.font('Helvetica').fontSize(10);
    // Package description row
    doc.text(payment.packageName, 50, rowY)
      .text(formatCurrency(payment.amount, payment.currency), 450, rowY, { width: 90, align: 'right' });
    rowY += 20;
    // Features list
    payment.packageFeatures.forEach(feat => {
      doc.circle(55, rowY + 3, 2).fill('#000000').fillColor('#000000').text(feat, 65, rowY);
      rowY += 15;
    });

    // === Total ===
    doc.font('Helvetica-Bold')
      .moveTo(350, rowY + 10).lineTo(545, rowY + 10).stroke();
    doc.text('Total Paid:', 350, rowY + 20)
      .text(formatCurrency(payment.amount, payment.currency), 450, rowY + 20, { width: 90, align: 'right' });

    // === Footer ===
    doc.fontSize(10).font('Helvetica-Oblique').fillColor('#666666')
      .text('Thank you for your business!', 50, 780, { align: 'center', width: 500 });

    doc.end();
  } catch (err) {
    console.error('Error generating receipt:', err);
    res.status(500).json({ message: 'Server error generating receipt' });
  }
};

/**
 * Stream a previously generated receipt via POST by receiptId
 */
exports.viewReceipt = async (req, res) => {
  try {
    const { receiptId } = req.body;
    if (!receiptId) {
      return res.status(400).json({ message: 'receiptId is required' });
    }
    const receipt = await Receipt.findByReceiptId(receiptId).populate('userId');
    if (!receipt) {
      return res.status(404).json({ message: 'Receipt not found' });
    }
    const user = receipt.userId;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Receipt_${receipt.receiptId}.pdf`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    // Render PDF using shared helper
    exports._renderReceiptPDF(doc, receipt, user);

    doc.end();
  } catch (err) {
    console.error('Error viewing receipt:', err);
    res.status(500).json({ message: 'Server error viewing receipt' });
  }
};

/**
 * Internal helper to DRY PDF layout for viewReceipt
 */
exports._renderReceiptPDF = (doc, data, user) => {
  // Header, Info, Table, Total, Footer...
  // (Use data instead of payment where appropriate)
};

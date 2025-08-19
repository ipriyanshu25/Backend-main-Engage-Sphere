// controllers/paymentController.js
require('dotenv').config();
const mongoose   = require('mongoose');
const Razorpay   = require('razorpay');
const crypto     = require('crypto');

const Payment       = require('../model/payment');
const Subscription  = require('../model/Subscription');
const User          = require('../model/user');   // make sure path/casing matches your project
const Plan          = require('../model/plan');

// ── Razorpay client ─────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ── Create Order ────────────────────────────────────────────────
// Requires: userId, planId, pricingId, profileLink, currency?, receipt?
exports.createOrder = async (req, res) => {
  try {
    const { userId, planId, pricingId, profileLink, currency = 'USD', receipt } = req.body;

    if (!userId || !planId || !pricingId || !profileLink) {
      return res.status(400).json({ 
        success: false, 
        message: 'userId, planId, pricingId, and profileLink are required' 
      });
    }

    // Validate user & plan
    const [ user, plan ] = await Promise.all([
      User.findOne({ userId }),
      Plan.findOne({ planId })
    ]);

    if (!user)  return res.status(404).json({ success:false, message:'User not found' });
    if (!plan)  return res.status(404).json({ success:false, message:'Plan not found' });

    // Validate pricing tier
    const tier = plan.pricing.find(p => p.pricingId === pricingId);
    if (!tier)  return res.status(404).json({ success:false, message:'Tier not found' });

    // Parse price to minor units
    const amount = Math.round(parseFloat(String(tier.price).replace(/[^0-9.-]+/g,'')) * 100);

    // Razorpay order
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt: receipt || crypto.randomBytes(10).toString('hex'),
      notes: {
        userId,
        planId,
        pricingId,
        profileLink
      }
    });

    // Create Payment record ONLY (no subscription yet)
    await Payment.create({
      orderId:    order.id,
      amount,
      currency,
      receipt:    order.receipt,
      userId,
      planId,
      pricingId,
      profileLink,
      status:     'created'
    });

    return res.status(201).json({ success:true, order });
  } catch (err) {
    console.error('createOrder error:', err);
    return res.status(500).json({ success:false, message:err.message });
  }
};

// ── Verify Payment ──────────────────────────────────────────────
// Creates Subscription ONLY AFTER successful verification.
exports.verifyPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success:false, message:'Missing Razorpay fields' });
    }

    /* 1. Signature check -------------------------------------------------- */
    const expectedSig = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                              .update(`${razorpay_order_id}|${razorpay_payment_id}`)
                              .digest('hex');

    if (expectedSig !== razorpay_signature) {
      await Payment.findOneAndUpdate(
        { orderId: razorpay_order_id },
        { status: 'failed' },
        { session }
      );
      await session.commitTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    /* 2. Fetch payment from Razorpay -------------------------------------- */
    const rpPayment = await razorpay.payments.fetch(razorpay_payment_id);
    if (rpPayment.status !== 'captured') {
      await Payment.findOneAndUpdate(
        { orderId: razorpay_order_id },
        { status: rpPayment.status === 'failed' ? 'failed' : rpPayment.status },
        { session }
      );
      await session.commitTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: `Payment ${rpPayment.status}` });
    }

    /* 3. Update Payment doc to 'paid' ------------------------------------- */
    const paymentDoc = await Payment.findOneAndUpdate(
      { orderId: razorpay_order_id },
      {
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
        status:    'paid',
        paidAt:    new Date()
      },
      { new: true, session }
    );

    if (!paymentDoc) {
      throw new Error('Payment document not found for this order');
    }

    /* 4. Create Subscription (first time only) ---------------------------- */
    // fetch Plan to get planName
    const plan = await Plan.findOne({ planId: paymentDoc.planId }).session(session);
    if (!plan) {
      throw new Error('Plan not found while creating subscription');
    }

    // optional expiry logic — set if you later add duration fields
    let expires = undefined;

    // Ensure idempotency: if a subscription already exists for this order, skip creation
    const existing = await Subscription.findOne({ orderId: razorpay_order_id }).session(session);
    if (!existing) {
      await Subscription.create([{
        userId:      paymentDoc.userId,
        planId:      paymentDoc.planId,
        pricingId:   paymentDoc.pricingId,
        planName:    plan.name,
        profileLink: paymentDoc.profileLink,

        orderId:     razorpay_order_id,
        paymentId:   razorpay_payment_id,

        amount:      paymentDoc.amount,
        currency:    paymentDoc.currency,

        status:      'active',      // active immediately upon verified pay
        adminStatus: 0,             // admin will move to 1 when completed

        startedAt:   new Date(),
        expiresAt:   expires
      }], { session });
    }

    /* 5. Commit + respond -------------------------------------------------- */
    await session.commitTransaction();
    session.endSession();
    return res.json({ success: true, message: 'Payment verified, subscription created & active' });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('verifyPayment error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

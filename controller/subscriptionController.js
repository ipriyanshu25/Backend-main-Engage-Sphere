// controllers/subscriptionController.js
const Subscription = require('../model/Subscription');
const Plan         = require('../model/plan');

/** Owner-only rule (no admin bypass) */
const isOwner = (sub, reqUser) => sub.userId === reqUser.userId;
/** For list endpoints where we only have a userId */
const isSelf  = (reqUser, targetUserId) =>
  reqUser && String(reqUser.userId) === String(targetUserId);

/* ------------------------------------------------------------------
   POST /subscriptions/user   { userId }
   -> returns subscriptions + total count for that user
-------------------------------------------------------------------*/
exports.getUserSubscriptions = async (req, res) => {
  try {
    const userId = req.body?.userId || req.query?.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const [subs, total] = await Promise.all([
      Subscription.find({ userId })
        .sort({ createdAt: -1 })
        .select('-__v')
        .lean(),
      Subscription.countDocuments({ userId }),
    ]);

    // Optional: enrich with pricing by pricingId
    const planIds = [...new Set(subs.map(s => s.planId).filter(Boolean))];
    const plans = await Plan.find({ planId: { $in: planIds } })
      .select('planId pricing')
      .lean();
    const planMap = new Map(plans.map(pl => [pl.planId, pl]));

    const enriched = subs.map(s => {
      const plan = planMap.get(s.planId);
      const matched = plan?.pricing?.find((pr) => pr.pricingId === s.pricingId) || null;
      return {
        ...s,
        pricing: matched
          ? {
              pricingId: matched.pricingId,
              name: matched.name,
              price: matched.price,
              description: matched.description || '',
              features: matched.features || [],
              isPopular: !!matched.isPopular,
            }
          : null,
      };
    });

    return res.status(200).json({ success: true, total, subscriptions: enriched });
  } catch (err) {
    console.error('getUserSubscriptions error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/* ------------------------------------------------------------------
   POST /subscriptions/cancel  { subscriptionId }
-------------------------------------------------------------------*/
exports.cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    if (!subscriptionId)
      return res.status(400).json({ success:false, message:'subscriptionId required' });

    const sub = await Subscription.findOne({ subscriptionId });
    if (!sub) return res.status(404).json({ success:false, message:'Not found' });
    if (!isOwner(sub, req.user))
      return res.status(403).json({ success:false, message:'Forbidden' });

    sub.status      = 'cancelled';
    sub.cancelledAt = new Date();
    await sub.save();

    res.json({ success:true, subscription: sub });
  } catch (err) {
    console.error('cancelSubscription error:', err);
    res.status(500).json({ success:false, message:'Internal server error' });
  }
};

/* ------------------------------------------------------------------
   POST /subscriptions/update
   Body: { userId, planId?, pricingId?, currency?, price? }
-------------------------------------------------------------------*/
exports.updateSubscription = async (req, res) => {
  try {
    const { userId, planId, pricingId, currency, price } = req.body;
    if (!userId)
      return res.status(400).json({ success:false, message:'userId is required' });

    /* ------------------------------------------------------------------ */
    /* 1. Look for an existing subscription                               */
    /* ------------------------------------------------------------------ */
    let sub = await Subscription.findOne({ userId }).sort({ createdAt:-1 });

    /* ========== Case A – subscription exists: update it ========== */
    if (sub) {
      if (!isOwner(sub, req.user))
        return res.status(403).json({ success:false, message:'Forbidden' });

      if (planId)    sub.planId    = planId;
      if (pricingId) sub.pricingId = pricingId;
      if (currency)  sub.currency  = currency.toUpperCase();

      if (price != null) {
        const numeric = typeof price === 'number'
          ? price
          : parseFloat(String(price).replace(/[^0-9.-]+/g, ''));
        if (isNaN(numeric) || numeric <= 0)
          return res.status(400).json({ success:false, message:'Invalid price value' });
        sub.amount = Math.round(numeric * 100);
      }

      await sub.save();
      return res.json({ success:true, subscription: sub });
    }

    /* ========== Case B – no subscription: create a new one ========== */
    if (!planId || !pricingId || !currency)
      return res.status(400).json({ success:false, message:'planId, pricingId and currency required to create new subscription' });

    const plan = await Plan.findOne({ planId });
    if (!plan)
      return res.status(404).json({ success:false, message:'Plan not found' });

    /* determine amount */
    let amountMinor;
    if (price != null) {
      const numeric = typeof price === 'number'
        ? price
        : parseFloat(String(price).replace(/[^0-9.-]+/g, ''));
      if (isNaN(numeric) || numeric <= 0)
        return res.status(400).json({ success:false, message:'Invalid price value' });
      amountMinor = Math.round(numeric * 100);
    } else {
      const tier = plan.pricing.find(p => p.pricingId === pricingId);
      if (!tier)
        return res.status(400).json({ success:false, message:'Pricing tier not found in plan, and no price supplied' });
      amountMinor = Math.round(parseFloat(tier.price.replace(/[^0-9.-]+/g,''))*100);
    }

    /* expiry date */
    let expiresAt = null;
    if (plan.durationMonths) {
      expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + plan.durationMonths);
    }

    sub = await Subscription.create({
      userId,
      planId,
      pricingId,
      currency: currency.toUpperCase(),
      amount:   amountMinor,
      status:   'active',
      startedAt: new Date(),
      expiresAt
    });

    return res.status(201).json({ success:true, subscription: sub });

  } catch (err) {
    console.error('updateSubscription error:', err);
    res.status(500).json({ success:false, message:'Internal server error' });
  }
};

/* ------------------------------------------------------------------
   POST /subscriptions/renew   { subscriptionId }
-------------------------------------------------------------------*/
exports.renewSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    if (!subscriptionId)
      return res.status(400).json({ success:false, message:'subscriptionId required' });

    const sub = await Subscription.findOne({ subscriptionId });
    if (!sub) return res.status(404).json({ success:false, message:'Not found' });
    if (!isOwner(sub, req.user))
      return res.status(403).json({ success:false, message:'Forbidden' });

    const plan = await Plan.findOne({ planId: sub.planId });
    if (!plan || !plan.durationMonths)
      return res.status(400).json({ success:false, message:'Plan has no durationMonths' });

    const now = new Date();
    const exp = new Date();
    exp.setMonth(exp.getMonth() + plan.durationMonths);

    sub.status    = 'active';
    sub.startedAt = now;
    sub.expiresAt = exp;
    await sub.save();

    res.json({ success:true, subscription: sub });
  } catch (err) {
    console.error('renewSubscription error:', err);
    res.status(500).json({ success:false, message:'Internal server error' });
  }
};

/* ------------------------------------------------------------------
   NEW: POST /subscriptions/user/completed   { userId }
   - completed = status == 1 (numeric) OR any of ['completed','cancelled','expired']
-------------------------------------------------------------------*/
exports.getUserCompletedSubscriptions = async (req, res) => {
  try {
    const { userId, page = 1, limit = 10 } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, parseInt(limit, 10));

    const filter = { userId, Status: 1 }; // 1 = completed
    const total = await Subscription.countDocuments(filter);

    const subscriptions = await Subscription.find(filter)
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .select('-__v')
      .lean();

    const planIds = [...new Set(subscriptions.map(s => s.planId).filter(Boolean))];
    const plans = await Plan.find({ planId: { $in: planIds } })
      .select('planId pricing')
      .lean();
    const planMap = new Map(plans.map(pl => [pl.planId, pl]));

    const enriched = subscriptions.map(s => {
      const plan = planMap.get(s.planId);
      const matchedPricing = plan?.pricing?.find(pr => pr.pricingId === s.pricingId) || null;
      return {
        ...s,
        pricing: matchedPricing
          ? {
              pricingId: matchedPricing.pricingId,
              name: matchedPricing.name,
              price: matchedPricing.price,
              description: matchedPricing.description || '',
              features: matchedPricing.features || [],
              isPopular: !!matchedPricing.isPopular,
            }
          : null,
      };
    });

    return res.status(200).json({
      data: enriched,
      meta: {
        total,
        page: p,
        perPage: l,
        lastPage: Math.ceil(total / l),
      },
    });
  } catch (err) {
    console.error('getUserCompletedSubscriptions error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/* ------------------------------------------------------------------
   NEW: POST /subscriptions/user/inprocess   { userId }
   - in-process = status == 0 (numeric) OR any of ['active','processing','in_process']
-------------------------------------------------------------------*/

exports.getUserInProcessSubscriptions = async (req, res) => {
  try {
    const { userId, page = 1, limit = 10 } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, parseInt(limit, 10));

    const filter = { userId, Status: 0 }; // 0 = in process
    const total = await Subscription.countDocuments(filter);

    const subscriptions = await Subscription.find(filter)
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .select('-__v')
      .lean();

    // Collect unique planIds for one-shot lookup
    const planIds = [...new Set(subscriptions.map(s => s.planId).filter(Boolean))];

    const plans = await Plan.find({ planId: { $in: planIds } })
      .select('planId pricing') // we only need pricing array and planId
      .lean();

    const planMap = new Map(plans.map(pl => [pl.planId, pl]));

    // Attach the matched pricing subdoc to each subscription
    const enriched = subscriptions.map(s => {
      const plan = planMap.get(s.planId);
      let matchedPricing = null;

      if (plan?.pricing?.length) {
        matchedPricing = plan.pricing.find(pr => pr.pricingId === s.pricingId) || null;
      }

      return {
        ...s,
        pricing: matchedPricing
          ? {
              pricingId: matchedPricing.pricingId,
              name: matchedPricing.name,
              price: matchedPricing.price,
              description: matchedPricing.description || '',
              features: matchedPricing.features || [],
              isPopular: !!matchedPricing.isPopular,
            }
          : null,
      };
    });

    return res.status(200).json({
      data: enriched,
      meta: {
        total,
        page: p,
        perPage: l,
        lastPage: Math.ceil(total / l),
      },
    });
  } catch (err) {
    console.error('getUserInProcessSubscriptions error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
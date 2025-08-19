// controller/planController.js

const Plan = require('../model/plan');

/**
 * Get all plans
 * POST /api/plans/all
 */
exports.getAllPlans = async (req, res) => {
  // pull pagination/search out of body, with defaults
  const { page = 1, limit = 10, search = '' } = req.body;
  const pageNum  = Math.max(parseInt(page, 10), 1);
  const limitNum = Math.max(parseInt(limit, 10), 1);

  // build our filter
  const filter = {};
  if (search) {
    filter.name = { $regex: search, $options: 'i' };
  }

  try {
    // total matching docs
    const total = await Plan.countDocuments(filter);

    // fetch this page
    const plans = await Plan.find(filter)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    return res.json({
      total,                 // total number of matching plans
      page: pageNum,         // current page
      pages: Math.ceil(total / limitNum), // total pages
      limit: limitNum,       // how many per page
      plans                  // the slice of results
    });
  } catch (err) {
    console.error('❌ getAllPlans error:', err);
    return res.status(500).json({ error: err.message });
  }
};
/**
 * Get plan by planId
 * POST /api/plans/id
 */
exports.getPlanById = async (req, res) => {
  const { planId } = req.body;
  if (!planId) {
    return res.status(400).json({ error: 'planId is required in request body' });
  }

  try {
    const plan = await Plan.findOne({ planId });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    return res.json(plan);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


exports.updatePlan = async (req, res) => {
  const { planId, pricing, ...planFields } = req.body;
  if (!planId) {
    return res.status(400).json({ error: 'planId is required' });
  }

  try {
    const plan = await Plan.findOne({ planId });
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // 1) apply any top‐level plan changes
    Object.entries(planFields).forEach(([key, val]) => {
      plan[key] = val;
    });

    // 2) apply each pricing‐tier change
    if (Array.isArray(pricing)) {
      pricing.forEach(tierUpdate => {
        const { pricingId, ...tierFields } = tierUpdate;
        const idx = plan.pricing.findIndex(p => p.pricingId === pricingId);
        if (idx === -1) {
          // optional: push new tier if it doesn’t exist
          plan.pricing.push({ pricingId, ...tierFields });
        } else {
          Object.entries(tierFields).forEach(([k, v]) => {
            plan.pricing[idx][k] = v;
          });
        }
      });
    }

    await plan.save();
    return res.json(plan);
  } catch (err) {
    console.error('❌ Update error:', err);
    return res.status(500).json({ error: err.message });
  }
};


exports.deletePlan = async (req, res) => {
  const { planId } = req.body;
  if (!planId) {
    return res.status(400).json({ error: 'planId is required' });
  }

  try {
    const deleted = await Plan.findOneAndDelete({ planId });
    if (!deleted) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    return res.json({ message: 'Plan deleted successfully' });
  } catch (err) {
    console.error('❌ Delete plan error:', err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Delete a single pricing tier by pricingId
 * POST /api/plans/delete-pricing
 */
exports.deletePricing = async (req, res) => {
  const { pricingId } = req.body;
  if (!pricingId) {
    return res.status(400).json({ error: 'pricingId is required' });
  }

  try {
    const updated = await Plan.findOneAndUpdate(
      { 'pricing.pricingId': pricingId },
      { $pull: { pricing: { pricingId } } },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: 'Pricing tier not found' });
    }
    return res.json(updated);
  } catch (err) {
    console.error('❌ Delete pricing error:', err);
    return res.status(500).json({ error: err.message });
  }
};

exports.getPlanByName = async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required in request body' });
  }

  try {
    // Case-insensitive match on the `name` field
    const plan = await Plan.findOne({ name: { $regex: `^${name}$`, $options: 'i' } });
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    return res.json(plan);
  } catch (err) {
    console.error('❌ getPlanByName error:', err);
    return res.status(500).json({ error: err.message });
  }
};
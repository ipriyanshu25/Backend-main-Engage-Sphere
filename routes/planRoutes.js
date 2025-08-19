const express = require('express');
const router = express.Router();
const ctrl = require('../controller/planController');

// ✅ Get all plans
router.post('/all', ctrl.getAllPlans);

// ✅ Get plan by planId
router.post('/getByPlanId', ctrl.getPlanById);

// ✅ Update plan by _id
router.post('/update', ctrl.updatePlan);

router.post('/deletePlan', ctrl.deletePlan);


router.post('/deletePricing', ctrl.deletePricing);

router.post('/getByname', ctrl.getPlanByName);




module.exports = router;

const express = require('express');
const router = express.Router();
const ctrl = require('../controller/planController');

// ✅ Create a new plan
router.post('/create', ctrl.createPlan);

// ✅ Get all plans
router.post('/all', ctrl.getAllPlans);

// ✅ Get plan by planId
router.post('/getByPlanId', ctrl.getPlanById);

// ✅ Update plan by _id
router.post('/update', ctrl.updatePlan);

router.post('/deletePlan', ctrl.deletePlan);


router.post('/deletePricing', ctrl.deletePricing);

router.post('/getByname', ctrl.getPlanByName);

router.post('/getPlanBySerivceAndSubServiceId', ctrl.getByServiceAndSubServiceId);

module.exports = router;

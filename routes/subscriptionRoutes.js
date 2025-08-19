const router        = require('express').Router();
const sc            = require('../controller/subscriptionController');
const { verifyToken } = require('../controller/userController');

// every route is POST now
router.post('/user',              sc.getUserSubscriptions);
router.post('/cancel',              verifyToken,            sc.cancelSubscription);
router.post('/update',              verifyToken,            sc.updateSubscription);
router.post('/renew',               verifyToken,            sc.renewSubscription);
router.post('/completedService',           sc.getUserCompletedSubscriptions);
router.post('/activeService',              sc.getUserInProcessSubscriptions);

module.exports = router;

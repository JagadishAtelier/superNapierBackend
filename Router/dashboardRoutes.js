const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

// Full dashboard payload
router.get('/', protect, dashboardController.getDashboard);
router.get('/distribution-map', protect, dashboardController.getDistributionMapData);

module.exports = router;

const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const rateLimit = require('express-rate-limit');

const { protect, restrictToRole } = require('../middleware/auth');

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: { success: false, message: 'Too many submissions from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', contactLimiter, contactController.submitContactForm);

// Admin Routes
router.get('/submissions', protect, restrictToRole('admin'), contactController.getSubmissions);
router.put('/submissions/:id/status', protect, restrictToRole('admin'), contactController.updateSubmissionStatus);

module.exports = router;

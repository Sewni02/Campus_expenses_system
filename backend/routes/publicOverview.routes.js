const express = require('express');
const rateLimit = require('express-rate-limit');
const { systemOverview, landingSummary } = require('../controllers/publicOverview.controller');

const router = express.Router();

// Open to anyone, so keep it cheap and hard to hammer.
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { message: 'Too many requests. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/system-overview', publicLimiter, systemOverview);
router.get('/landing-summary', publicLimiter, landingSummary);

module.exports = router;
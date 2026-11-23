const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth.middleware');
const { grandTotals } = require('../controllers/grandTotal.controller');

// The money of every function added together - super admin only.
router.use(protect, requireRole('super_admin'));

router.get('/', grandTotals);

module.exports = router;
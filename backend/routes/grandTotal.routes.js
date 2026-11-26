const express = require('express');
const router = express.Router();
const { protect, requireApproved } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/permission.middleware');
const { grandTotals } = require('../controllers/grandTotal.controller');

// The money of every function added together - super admin, or a user with the
// "Grand Total" permission (read-only).
router.use(protect, requireApproved, requirePermission('grand_total_view'));

router.get('/', grandTotals);

module.exports = router;
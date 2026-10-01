const express = require('express');
const router = express.Router();
const { protect, requireApproved, requireRole } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/permission.middleware');
const upload = require('../middleware/upload');
const c = require('../controllers/pettyCash.controller');

router.use(protect, requireApproved);

// ----- Accountant: needs the "Petty Cash" permission, sees ONLY their own data -----
const accountantOnly = requirePermission('petty_cash_manage');
router.get('/categories', accountantOnly, c.getCategories);
router.get('/me/summary', accountantOnly, c.getMySummary);
router.get('/me/allocations', accountantOnly, c.getMyAllocations);
router.get('/me/allocations/pending', accountantOnly, c.getMyPendingAllocations);
router.get('/me/allocations/:id/slip', accountantOnly, c.getMySlip);
router.post('/me/allocations/:id/receive', accountantOnly, c.receiveAllocation);
router.get('/me/expenses', accountantOnly, c.getMyExpenses);
router.post('/me/expenses', accountantOnly, c.createExpense);

// ----- Super admin: allocate funds, watch spending, month-end analysis -----
const superAdminOnly = requireRole('super_admin');
router.get('/admin/accountants', superAdminOnly, c.getAccountants);
router.get('/admin/allocations', superAdminOnly, c.getAllocations);
router.post('/admin/allocations', superAdminOnly, upload.single('slip'), c.createAllocation);
router.get('/admin/allocations/:id/slip', superAdminOnly, c.getAdminSlip);
router.delete('/admin/allocations/:id', superAdminOnly, c.deleteAllocation);
router.get('/admin/expenses', superAdminOnly, c.getAllExpenses);
router.get('/admin/summary', superAdminOnly, c.getAdminSummary);

module.exports = router;
const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth.middleware');
const {
  getAllUsers,
  getUserStats,
  approveUser,
  rejectUser,
} = require('../controllers/admin.controller');
const { getAuditLogs } = require('../controllers/audit.controller');

// Every route here is super-admin only.
router.use(protect, requireRole('super_admin'));

router.get('/users', getAllUsers);
router.get('/stats', getUserStats);
router.put('/users/:id/approve', approveUser);
router.put('/users/:id/reject', rejectUser);

// Who did what, and when (read-only; nothing can edit or delete these rows).
router.get('/audit-logs', getAuditLogs);

module.exports = router;
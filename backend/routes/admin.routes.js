const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth.middleware');
const {
  getAllUsers,
  getUserStats,
  approveUser,
  rejectUser,
} = require('../controllers/admin.controller');

// Every route here is super-admin only.
router.use(protect, requireRole('super_admin'));

router.get('/users', getAllUsers);
router.get('/stats', getUserStats);
router.put('/users/:id/approve', approveUser);
router.put('/users/:id/reject', rejectUser);

module.exports = router;
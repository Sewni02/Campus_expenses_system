const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserStats,
  approveUser,
  rejectUser,
} = require('../controllers/admin.controller');

router.get('/users', getAllUsers);
router.get('/stats', getUserStats);
router.put('/users/:id/approve', approveUser);
router.put('/users/:id/reject', rejectUser);

module.exports = router;


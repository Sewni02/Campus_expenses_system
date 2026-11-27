const express = require('express');
const router = express.Router();
const { signup, login, social, socialConfig, logout, forgotPassword, resetPassword, me } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

// Fresh copy of the logged-in user (so permission changes show up without re-login)
router.get('/me', protect, me);
router.post('/signup', signup);
router.post('/login', login);
router.get('/social-config', socialConfig);
router.post('/social', social);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
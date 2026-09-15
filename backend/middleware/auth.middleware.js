const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Checks the "Authorization: Bearer <token>" header sent with the request.
// If the token is valid AND the user still exists AND hasn't been rejected,
// attaches the current user info to req.user and lets the request continue.
// Otherwise it stops the request here.
//
// We re-check the DB (instead of only trusting the JWT payload) because a
// user's role/status can change after the token was issued (e.g. an admin
// rejects someone mid-session) and we don't want a stale token to keep
// working.
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided. Please log in.' });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'This account no longer exists. Please log in again.' });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ message: 'Your account access has been rejected.' });
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      status: user.status,
      permissions: user.permissions,
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token. Please log in again.' });
  }
};

// Use this AFTER protect, only on routes that need a specific role.
// Example: router.use(protect, requireRole('super_admin'))
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to do this.' });
    }
    next();
  };
};

// Use this AFTER protect, on routes that regular (non-super-admin) users
// need to be approved by an admin before they can use. Super admins are
// always approved on signup, so they're let through automatically.
const requireApproved = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'No token provided. Please log in.' });
  }
  if (req.user.role === 'super_admin' || req.user.status === 'approved') {
    return next();
  }
  return res.status(403).json({ message: 'Your account is not approved yet. Please wait for admin approval.' });
};

module.exports = { protect, requireRole, requireApproved };
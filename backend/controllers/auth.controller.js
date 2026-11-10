const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');
const User = require('../models/user.model');
const { COOKIE_NAME, setAuthCookie, clearAuthCookie } = require('../config/auth');
const { recordAudit, requestMeta } = require('../utils/audit');

const signup = asyncHandler(async (req, res) => {
  const result = await authService.signupUser(req.body, requestMeta(req));
  res.status(201).json(result);
});

const login = asyncHandler(async (req, res) => {
  const { token, ...result } = await authService.loginUser(req.body, requestMeta(req));
  // The token goes into an httpOnly cookie. It is NOT in the JSON response,
  // so JavaScript on the page can never read it.
  setAuthCookie(res, token);
  res.json(result);
});

// Works even if the cookie already expired (it just clears whatever is there).
const logout = asyncHandler(async (req, res) => {
  let user;
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = { id: decoded.id, role: decoded.role };
    } catch {
      // expired / invalid token: nothing to log, still clear the cookie
    }
  }

  clearAuthCookie(res);
  if (user) recordAudit({ action: 'LOGOUT', user, meta: requestMeta(req) });
  res.json({ message: 'Logged out' });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.requestPasswordReset(req.body, requestMeta(req));
  res.json(result);
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(
    { token: req.params.token, password: req.body.password },
    requestMeta(req)
  );
  res.json(result);
});

const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('name email role status permissions');
  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    permissions: user.permissions,
  });
});

module.exports = { signup, login, logout, forgotPassword, resetPassword, me };
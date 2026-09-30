const User = require('../models/user.model');
const { ApiError, findOrFail } = require('../utils/ApiError');
const { ALLOWED_PERMISSIONS } = require('../config/permissions');

// Fields that must never be sent to the browser - not even to a super admin.
// (The reset token is a live credential for the account while it's valid.)
const HIDDEN_FIELDS = '-password -resetPasswordToken -resetPasswordExpires';

const sanitizeUser = (userDoc) => {
  const user = userDoc.toObject();
  delete user.password;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpires;
  return user;
};

// Turns whatever the client sent into a clean list of permission keys, or
// throws 400. Only keys listed in config/permissions.js are accepted, and
// duplicates are dropped.
const normalizePermissions = (permissions) => {
  if (permissions === undefined || permissions === null) return [];
  if (!Array.isArray(permissions)) {
    throw new ApiError(400, 'permissions must be a list');
  }

  const unique = [...new Set(permissions)];
  const unknown = unique.filter((p) => typeof p !== 'string' || !ALLOWED_PERMISSIONS.includes(p));
  if (unknown.length > 0) {
    throw new ApiError(400, `Unknown permission(s): ${unknown.map(String).join(', ')}`);
  }
  return unique;
};

// Super admin accounts are not managed through approve/reject. Without this,
// one super admin could reject another (or themselves) and lock everyone
// out, or overwrite their '*' permissions with a shorter list.
const assertNotSuperAdmin = (user) => {
  if (user.role === 'super_admin') {
    throw new ApiError(400, 'Super admin accounts cannot be changed here');
  }
};

const listUsers = async () => {
  return User.find().select(HIDDEN_FIELDS);
};

const getUserStats = async () => {
  const [total, approved, rejected] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: 'approved' }),
    User.countDocuments({ status: 'rejected' }),
  ]);
  return { total, approved, rejected };
};

const approveUser = async (id, permissions) => {
  const cleanPermissions = normalizePermissions(permissions);

  const user = await findOrFail(User, id, 'User not found');
  assertNotSuperAdmin(user);

  user.status = 'approved';
  user.permissions = cleanPermissions;
  await user.save();

  return { message: 'User permissions saved successfully', user: sanitizeUser(user) };
};

const rejectUser = async (id) => {
  const user = await findOrFail(User, id, 'User not found');
  assertNotSuperAdmin(user);

  user.status = 'rejected';
  user.permissions = [];
  await user.save();

  return { message: 'User rejected', user: sanitizeUser(user) };
};

module.exports = { listUsers, getUserStats, approveUser, rejectUser };
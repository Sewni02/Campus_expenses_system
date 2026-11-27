const User = require('../models/user.model');
const { ApiError, findOrFail } = require('../utils/ApiError');
const { ALLOWED_PERMISSIONS } = require('../config/permissions');

// Fields that must never be sent to the browser - not even to a super admin.
// (The reset token is a live credential for the account while it's valid.)
const HIDDEN_FIELDS = '-password -resetPasswordToken -resetPasswordExpires -resetPasswordAttempts';

const sanitizeUser = (userDoc) => {
  const user = userDoc.toObject();
  delete user.password;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpires;
  delete user.resetPasswordAttempts;
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

// A super admin has full access, and that includes managing every other account -
// other super admins too. Two guards stop a super admin from locking everyone out:
//   1. you cannot reject or demote YOUR OWN account (ask another super admin), and
//   2. the last approved super admin can never be rejected or demoted.
const activeSuperAdminCount = (excludeId) =>
  User.countDocuments({ role: 'super_admin', status: 'approved', _id: { $ne: excludeId } });

const assertSafeToDemote = async (target, actorId, action) => {
  if (target.role !== 'super_admin') return;
  if (actorId && String(target._id) === String(actorId)) {
    throw new ApiError(400, `You cannot ${action} your own account. Ask another super admin to do it.`);
  }
  if (target.status === 'approved' && (await activeSuperAdminCount(target._id)) === 0) {
    throw new ApiError(400, `At least one approved super admin must remain, so this account cannot be ${action === 'reject' ? 'rejected' : 'demoted'}.`);
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

// Roles a super admin can give from User Management. 'accountant' always has Petty Cash.
// 'super_admin' = full access to everything (stored as the '*' permission, which is
// never accepted from the request body - it is set here only).
const ASSIGNABLE_ROLES = ['employee', 'accountant', 'super_admin'];

const approveUser = async (id, permissions, role, actorId) => {
  const cleanPermissions = normalizePermissions(permissions);
  if (role !== undefined && !ASSIGNABLE_ROLES.includes(role)) {
    throw new ApiError(400, `Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}`);
  }

  const user = await findOrFail(User, id, 'User not found');
  const finalRole = role !== undefined ? role : user.role;

  // Taking the super admin role away from someone (or from yourself) needs the guards.
  if (user.role === 'super_admin' && finalRole !== 'super_admin') {
    await assertSafeToDemote(user, actorId, 'demote');
  }

  user.status = 'approved';
  user.role = finalRole;
  // A super admin always has full access; everyone else gets exactly the ticked permissions.
  user.permissions = finalRole === 'super_admin' ? ['*'] : cleanPermissions;
  await user.save();

  return { message: 'User permissions saved successfully', user: sanitizeUser(user) };
};

const rejectUser = async (id, actorId) => {
  const user = await findOrFail(User, id, 'User not found');
  await assertSafeToDemote(user, actorId, 'reject');

  user.status = 'rejected';
  user.permissions = [];
  await user.save();

  return { message: 'User rejected', user: sanitizeUser(user) };
};

module.exports = { listUsers, getUserStats, approveUser, rejectUser };
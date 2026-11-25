const { ALLOWED_PERMISSIONS } = require('../config/permissions');

// Permission checks. Use these AFTER `protect` (which loads req.user,
// including a fresh copy of the user's permissions from the database on every
// request - so when a super admin changes someone's permissions, it takes
// effect immediately, no re-login needed).
//
//   router.use(protect, requireApproved, requireFinanceAccess);

// Super admins can do everything. ('*' is only ever stored on super admin
// accounts; the admin approve endpoint rejects it - see config/permissions.js.)
const isSuperAdmin = (user) =>
  user.role === 'super_admin' || (user.permissions || []).includes('*');

const FINANCE = {
  view: 'finance_view_payments',
  add: 'finance_add_payments',
  edit: 'finance_edit_payments',
  delete: 'finance_delete_payments',
};
const ALL_FINANCE_PERMISSIONS = Object.values(FINANCE);

const forbid = (res, needed) =>
  res.status(403).json({
    message: `You do not have permission to do this (requires: ${needed.join(' or ')}).`,
  });

// Allows the request if the user has AT LEAST ONE of the listed permissions.
//   router.delete('/:id', requirePermission('finance_delete_payments'), remove)
const requirePermission = (...keys) => {
  // A typo in a key would silently lock everyone (except super admins) out of
  // a route, so fail loudly at startup instead.
  keys.forEach((key) => {
    if (!ALLOWED_PERMISSIONS.includes(key)) {
      throw new Error(`requirePermission: unknown permission "${key}" (see config/permissions.js)`);
    }
  });

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'No token provided. Please log in.' });
    }
    if (isSuperAdmin(req.user)) return next();

    const owned = req.user.permissions || [];
    if (keys.some((key) => owned.includes(key))) return next();

    return forbid(res, keys);
  };
};

// Reading: any finance permission is enough. Someone who may add / edit /
// delete payments also needs to load the lists (suppliers, projects, ...) to
// use the forms, so we don't demand 'view' specifically for reads.
const requireFinanceRead = requirePermission(...ALL_FINANCE_PERMISSIONS);

const requireFinanceAdd = requirePermission(FINANCE.add);
const requireFinanceEdit = requirePermission(FINANCE.edit);
const requireFinanceDelete = requirePermission(FINANCE.delete);

// One guard for a whole finance router, chosen by HTTP method:
//   GET / HEAD  -> any finance permission (read)
//   POST        -> finance_add_payments
//   PUT / PATCH -> finance_edit_payments  (edits, "mark as paid", confirm)
//   DELETE      -> finance_delete_payments
// Because it is decided by method, a route added to the file later is
// protected automatically - nobody has to remember to add a check.
// A read-only POST (e.g. the hardware price finder) is registered BEFORE
// this guard with requireFinanceRead instead.
const requireFinanceAccess = (req, res, next) => {
  switch (req.method) {
    case 'GET':
    case 'HEAD':
      return requireFinanceRead(req, res, next);
    case 'POST':
      return requireFinanceAdd(req, res, next);
    case 'PUT':
    case 'PATCH':
      return requireFinanceEdit(req, res, next);
    case 'DELETE':
      return requireFinanceDelete(req, res, next);
    default:
      return res.status(405).json({ message: 'Method not allowed' });
  }
};

module.exports = {
  requirePermission,
  requireFinanceAccess,
  requireFinanceRead,
  requireFinanceAdd,
  requireFinanceEdit,
  requireFinanceDelete,
};
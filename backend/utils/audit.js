const AuditLog = require('../models/auditLog.model');

// Where the request came from, in a form that is safe to store.
const requestMeta = (req) => ({
  ip: req.ip,
  userAgent: String(req.headers?.['user-agent'] || '').slice(0, 300),
});

// Writes one audit row. It NEVER throws and callers do not need to await it:
// a problem with the audit log must not break a login or a payment.
//
//   recordAudit({ action: 'LOGIN_FAILED', outcome: 'failed', meta, details: { email } })
const recordAudit = async ({ action, outcome = 'success', user, meta = {}, method, path, statusCode, details }) => {
  try {
    await AuditLog.create({
      action,
      outcome,
      actor: user?.id || user?._id,
      actorName: user?.name,
      actorEmail: user?.email,
      actorRole: user?.role,
      method,
      path,
      statusCode,
      ip: meta.ip,
      userAgent: meta.userAgent,
      details,
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
};

module.exports = { recordAudit, requestMeta };
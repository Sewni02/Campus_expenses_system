const mongoose = require('mongoose');

// One row per important thing that happened: logins, logouts, password
// resets, and every create / edit / delete request made by a logged-in user.
// Rows are only ever INSERTED by the system. No route edits or deletes them.
const auditLogSchema = new mongoose.Schema(
  {
    // e.g. "LOGIN_SUCCESS", "LOGIN_FAILED", "ACCOUNT_LOCKED", "LOGOUT",
    //      "PASSWORD_RESET", or "DELETE /api/hardware/:id" for data changes
    action: { type: String, required: true, index: true },
    outcome: { type: String, enum: ['success', 'failed'], default: 'success' },

    // Who did it. Name / email / role are copied here on purpose: the log must
    // still make sense after the user is renamed or removed.
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    actorName: { type: String },
    actorEmail: { type: String },
    actorRole: { type: String },

    method: { type: String },
    path: { type: String },
    statusCode: { type: Number },
    ip: { type: String },
    userAgent: { type: String },

    // Small extra facts (route params, the email that was tried, ...).
    // Never put passwords, tokens or whole request bodies in here.
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
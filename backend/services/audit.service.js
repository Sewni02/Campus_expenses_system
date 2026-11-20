const mongoose = require('mongoose');
const AuditLog = require('../models/auditLog.model');
const { ApiError } = require('../utils/ApiError');
const { optionalString } = require('../utils/validators');
const { containsRegex } = require('../utils/escapeRegex');

const toPositiveInt = (value, fallback, max) => {
  const number = parseInt(value, 10);
  if (!Number.isInteger(number) || number < 1) return fallback;
  return Math.min(number, max);
};

// Accepts "2026-11-10" or a full ISO date. A date-only `to` means "until the end of that day".
const parseDate = (value, field, endOfDay = false) => {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') throw new ApiError(400, `${field} must be a date`);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError(400, `${field} must be a valid date`);

  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
};

// GET /api/admin/audit-logs?page=1&limit=50&action=DELETE&outcome=failed&actor=<userId>&from=2026-11-01&to=2026-11-10
// Every filter is type-checked first, so nothing from the URL can turn into a MongoDB operator.
const listAuditLogs = async (query = {}) => {
  const page = toPositiveInt(query.page, 1, 100000);
  const limit = toPositiveInt(query.limit, 50, 200);
  const filter = {};

  const action = optionalString(query.action, 'action', { max: 100 });
  if (action) filter.action = containsRegex(action);

  if (query.outcome !== undefined && query.outcome !== '') {
    if (!['success', 'failed'].includes(query.outcome)) {
      throw new ApiError(400, 'outcome must be success or failed');
    }
    filter.outcome = query.outcome;
  }

  if (query.actor !== undefined && query.actor !== '') {
    if (typeof query.actor !== 'string' || !mongoose.isValidObjectId(query.actor)) {
      throw new ApiError(400, 'actor must be a valid user id');
    }
    filter.actor = query.actor;
  }

  const from = parseDate(query.from, 'from');
  const to = parseDate(query.to, 'to', true);
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return { items, page, limit, total, pages: Math.ceil(total / limit) };
};

module.exports = { listAuditLogs };
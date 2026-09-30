const { ApiError } = require('./ApiError');

// Small, dependency-free input checks used by the auth/admin services.
//
// The main goal is TYPE safety: JSON bodies can contain objects, arrays,
// numbers, etc. If `email` arrives as {"$gt": ""} and goes straight into
// User.findOne({ email }), MongoDB treats it as a query operator (NoSQL
// injection) and can match ANY user. Every helper here first checks
// `typeof value === 'string'`, so operators never reach a query.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Required string: must be a string, trimmed length between min and max.
// Returns the trimmed value.
const requireString = (value, field, { min = 1, max = 200 } = {}) => {
  if (typeof value !== 'string') {
    throw new ApiError(400, `${field} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new ApiError(400, `${field} is required`);
  }
  if (trimmed.length > max) {
    throw new ApiError(400, `${field} must be at most ${max} characters`);
  }
  return trimmed;
};

// Optional string: undefined / null / '' -> undefined. Anything else must be
// a string within the limit.
const optionalString = (value, field, { max = 200 } = {}) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new ApiError(400, `${field} must be text`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new ApiError(400, `${field} must be at most ${max} characters`);
  }
  return trimmed || undefined;
};

// Valid email, returned trimmed + lower-cased so "Kasun@Uni.lk" and
// "kasun@uni.lk" are treated as the same account.
const validateEmail = (value) => {
  const email = requireString(value, 'email', { max: 254 }).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new ApiError(400, 'Please enter a valid email address');
  }
  return email;
};

// Password rules for NEW passwords (signup + reset). Do NOT use this on
// login - existing users may have older, weaker passwords and must still be
// able to sign in.
// - at least 8 characters, with at least one letter and one number
// - at most 72 BYTES: bcrypt silently ignores everything after byte 72, so
//   a longer password would look stronger than it really is.
// Passwords are never trimmed (spaces are allowed).
const validatePassword = (value) => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ApiError(400, 'password is required');
  }
  if (value.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters long');
  }
  if (Buffer.byteLength(value, 'utf8') > 72) {
    throw new ApiError(400, 'Password is too long (maximum 72 characters)');
  }
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    throw new ApiError(400, 'Password must contain at least one letter and one number');
  }
  return value;
};

// ---------------------------------------------------------------------------
// Money & quantities
// ---------------------------------------------------------------------------
// Before this, services only checked `!amount`, so "-500", "abc", "Infinity"
// or 1e300 all passed the check and were stored as the payment amount.

const MAX_AMOUNT = 1_000_000_000_000; // 1 trillion - far above any real bill
const MAX_QUANTITY = 1_000_000_000;

// Turns a value from a JSON body (number) or a multipart form (always a
// string) into a finite Number, or returns null if it isn't a plain decimal.
// Strings must look like 1500, 1500.50 or -20 (a minus sign is recognised so
// the caller can say "must be greater than 0") - no "1e3", "0x10", "1,500",
// "Infinity" or spaces inside.
const toPlainNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const text = value.trim();
    return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : null;
  }
  return null;
};

const isBlank = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

// A money amount: greater than 0, at most MAX_AMOUNT, rounded to 2 decimals
// (so 10.999 is stored as 11 and floating-point dust like 0.1 + 0.2 is gone).
const validateAmount = (value, field = 'amount') => {
  if (isBlank(value)) throw new ApiError(400, `${field} is required`);

  const number = toPlainNumber(value);
  if (number === null) throw new ApiError(400, `${field} must be a valid number`);
  if (number <= 0) throw new ApiError(400, `${field} must be greater than 0`);
  if (number > MAX_AMOUNT) throw new ApiError(400, `${field} is too large`);

  return Math.round(number * 100) / 100;
};

// A stock / order quantity: 0 is allowed (out of stock), negative is not.
const validateQuantity = (value, field = 'quantity') => {
  if (isBlank(value)) throw new ApiError(400, `${field} is required`);

  const number = toPlainNumber(value);
  if (number === null) throw new ApiError(400, `${field} must be a valid number`);
  if (number < 0) throw new ApiError(400, `${field} cannot be negative`);
  if (number > MAX_QUANTITY) throw new ApiError(400, `${field} is too large`);

  return Math.round(number * 1000) / 1000;
};

// Escapes text before putting it inside an HTML email, so a name like
// <script>...</script> cannot inject markup into the message.
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

module.exports = {
  requireString,
  optionalString,
  validateEmail,
  validatePassword,
  validateAmount,
  validateQuantity,
  MAX_QUANTITY,
  escapeHtml,
};
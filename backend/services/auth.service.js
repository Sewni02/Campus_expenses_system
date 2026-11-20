const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/user.model');
const transporter = require('../config/email');
const { signToken } = require('../config/auth');
const { recordAudit } = require('../utils/audit');
const { ApiError } = require('../utils/ApiError');
const { exactRegex } = require('../utils/escapeRegex');
const {
  requireString,
  optionalString,
  validateEmail,
  validatePassword,
  escapeHtml,
} = require('../utils/validators');

// All auth business logic lives here. Controllers only translate
// HTTP <-> service calls; nothing in this file knows about req/res.
// `meta` = { ip, userAgent } passed in by the controller, used for the audit log.

// Account lockout: this many wrong passwords in a row locks the account for a while.
// (The IP rate limit in server.js still applies on top of this.)
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// Used only to keep login timing the same whether or not the email exists
// (see loginUser). Never matches a real password.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('not-a-real-password', 10);

// Case-insensitive lookup. New accounts are saved lower-case, but accounts
// created before that rule may still be stored with capital letters, so we
// match either way instead of locking those users out.
const findUserByEmail = (email) => User.findOne({ email: exactRegex(email) });

// Compares two secrets without leaking (via response time) how many leading
// characters were correct.
const safeEqual = (a, b) => {
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
};

const signupUser = async ({ name, email, password, department, adminCode }, meta = {}) => {
  const cleanName = requireString(name, 'name', { max: 100 });
  const cleanEmail = validateEmail(email);
  validatePassword(password);
  const cleanDepartment = optionalString(department, 'department', { max: 100 });
  const cleanAdminCode = optionalString(adminCode, 'adminCode', { max: 200 });

  const existingUser = await findUserByEmail(cleanEmail);
  if (existingUser) {
    throw new ApiError(400, 'Email already registered');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const isSuperAdmin =
    Boolean(cleanAdminCode) &&
    Boolean(process.env.ADMIN_SIGNUP_CODE) &&
    safeEqual(cleanAdminCode, process.env.ADMIN_SIGNUP_CODE);

  const newUser = await User.create({
    name: cleanName,
    email: cleanEmail,
    password: hashedPassword,
    // The role is decided HERE, never by the request. The only way to become a
    // super admin is the secret ADMIN_SIGNUP_CODE; everyone else starts as an
    // 'employee' and the super admin gives them access afterwards.
    role: isSuperAdmin ? 'super_admin' : 'employee',
    department: cleanDepartment,
    status: isSuperAdmin ? 'approved' : 'pending',
    permissions: isSuperAdmin ? ['*'] : [],
  });

  recordAudit({
    action: isSuperAdmin ? 'SIGNUP_SUPER_ADMIN' : 'SIGNUP',
    user: newUser,
    meta,
  });

  return {
    message: isSuperAdmin
      ? 'Super Admin account created successfully'
      : 'User registered successfully. Waiting for admin approval.',
    user: {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
    },
  };
};

// Counts one wrong password. Returns true if this attempt locked the account.
// Uses $inc so two simultaneous wrong guesses cannot be counted as one.
const registerFailedLogin = async (user) => {
  const updated = await User.findByIdAndUpdate(
    user._id,
    { $inc: { failedLoginAttempts: 1 } },
    { new: true }
  );

  if (updated && updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    await User.updateOne(
      { _id: user._id },
      { $set: { lockUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000), failedLoginAttempts: 0 } }
    );
    return true;
  }
  return false;
};

const loginUser = async ({ email, password }, meta = {}) => {
  // Login only checks TYPES (so an object can't be smuggled into the query).
  // It deliberately does not apply the new password rules - older accounts
  // may have shorter passwords and must still be able to sign in.
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const cleanEmail = email.trim();
  const user = await findUserByEmail(cleanEmail);

  // Locked account: stop before even checking the password.
  if (user && user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
    recordAudit({ action: 'LOGIN_BLOCKED_LOCKED', outcome: 'failed', user, meta });
    throw new ApiError(429, `Too many failed attempts. Try again in ${minutesLeft} minute(s).`);
  }

  // Always run one bcrypt comparison, even when the email doesn't exist.
  // Otherwise "unknown email" answers instantly while "wrong password" takes
  // ~100ms, which lets an attacker discover which emails are registered.
  const isMatch = await bcrypt.compare(password, user ? user.password : DUMMY_PASSWORD_HASH);
  if (!user || !isMatch) {
    if (user) {
      const nowLocked = await registerFailedLogin(user);
      recordAudit({ action: nowLocked ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED', outcome: 'failed', user, meta });
      if (nowLocked) {
        throw new ApiError(429, `Too many failed attempts. Account locked for ${LOCK_MINUTES} minutes.`);
      }
    } else {
      recordAudit({
        action: 'LOGIN_FAILED',
        outcome: 'failed',
        meta,
        details: { email: cleanEmail.slice(0, 254), reason: 'unknown email' },
      });
    }
    throw new ApiError(400, 'Invalid email or password');
  }

  // Correct password: clear any earlier failed attempts / expired lock.
  if (user.failedLoginAttempts || user.lockUntil) {
    await User.updateOne(
      { _id: user._id },
      { $set: { failedLoginAttempts: 0 }, $unset: { lockUntil: '' } }
    );
  }

  recordAudit({ action: 'LOGIN_SUCCESS', user, meta });

  return {
    message: 'Login successful',
    // The controller puts this in an httpOnly cookie and does NOT send it to the browser's JS.
    token: signToken(user),
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      permissions: user.permissions,
    },
  };
};

// Deliberately never reveals whether the email exists - always returns the
// same generic message, whether or not a reset email was actually sent.
const requestPasswordReset = async ({ email }, meta = {}) => {
  const genericMessage = { message: 'If that email is registered, a reset link has been sent.' };

  const cleanEmail = validateEmail(email);

  const user = await findUserByEmail(cleanEmail);
  if (!user) {
    return genericMessage;
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
  await user.save();

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  try {
    await transporter.sendMail({
      from: `"Campus Expense System" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Password Reset Request',
      html: `
      <p>Hi ${escapeHtml(user.name)},</p>
      <p>You requested a password reset. Click the link below to set a new password. This link expires in 15 minutes.</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you did not request this, please ignore this email.</p>
    `,
    });
    recordAudit({ action: 'PASSWORD_RESET_REQUESTED', user, meta });
  } catch (err) {
    // If the mail server fails we still answer with the generic message.
    // Returning an error here would tell a stranger "this email IS registered".
    console.error('Password reset email failed:', err.message);
    recordAudit({ action: 'PASSWORD_RESET_REQUESTED', outcome: 'failed', user, meta, details: { reason: 'email send failed' } });
  }

  return genericMessage;
};

const resetPassword = async ({ token, password }, meta = {}) => {
  if (typeof token !== 'string' || !token) {
    throw new ApiError(400, 'Reset link is invalid or has expired');
  }
  validatePassword(password);

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(400, 'Reset link is invalid or has expired');
  }

  user.password = await bcrypt.hash(password, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  // Log out every device that was using the old password, and unlock the account.
  user.passwordChangedAt = new Date();
  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  await user.save();

  recordAudit({ action: 'PASSWORD_RESET', user, meta });

  return { message: 'Password has been reset successfully. You can now log in.' };
};

module.exports = { signupUser, loginUser, requestPasswordReset, resetPassword };
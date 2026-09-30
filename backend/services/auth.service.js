const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/user.model');
const transporter = require('../config/email');
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

const signupUser = async ({ name, email, password, role, department, adminCode }) => {
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
    // TODO(security): `role` still comes straight from the request body, so a
    // client can ask for 'super_admin'. Left unchanged on purpose for now -
    // this is the known role-selection issue that is being handled separately.
    role: isSuperAdmin ? 'super_admin' : (role || 'employee'),
    department: cleanDepartment,
    status: isSuperAdmin ? 'approved' : 'pending',
    permissions: isSuperAdmin ? ['*'] : [],
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

const loginUser = async ({ email, password }) => {
  // Login only checks TYPES (so an object can't be smuggled into the query).
  // It deliberately does not apply the new password rules - older accounts
  // may have shorter passwords and must still be able to sign in.
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const user = await findUserByEmail(email.trim());

  // Always run one bcrypt comparison, even when the email doesn't exist.
  // Otherwise "unknown email" answers instantly while "wrong password" takes
  // ~100ms, which lets an attacker discover which emails are registered.
  const isMatch = await bcrypt.compare(password, user ? user.password : DUMMY_PASSWORD_HASH);
  if (!user || !isMatch) {
    throw new ApiError(400, 'Invalid email or password');
  }

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  return {
    message: 'Login successful',
    token,
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
const requestPasswordReset = async ({ email }) => {
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

  return genericMessage;
};

const resetPassword = async ({ token, password }) => {
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
  await user.save();

  return { message: 'Password has been reset successfully. You can now log in.' };
};

module.exports = { signupUser, loginUser, requestPasswordReset, resetPassword };
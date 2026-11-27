const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/user.model');
const { signToken } = require('../config/auth');
const { recordAudit } = require('../utils/audit');
const { ApiError } = require('../utils/ApiError');
const { exactRegex } = require('../utils/escapeRegex');

// "Continue with Google / Facebook".
//
// The browser gets a short-lived access token from Google / Facebook and sends
// it here. We NEVER trust the browser's word about who the user is: the token
// is checked with Google / Facebook themselves, and only a VERIFIED email is
// used. After that the normal Xpendly login cookie is issued, so everything
// else (roles, permissions, approval) works exactly like a password login.
//
// .env settings (see README / the notes in the reply):
//   GOOGLE_CLIENT_ID     - Google Cloud Console > OAuth client (Web)
//   FACEBOOK_APP_ID      - Meta for Developers > your app
//   FACEBOOK_APP_SECRET  - same app (kept on the server only)

const PROVIDERS = ['google', 'facebook'];

const getConfig = () => ({
  google: process.env.GOOGLE_CLIENT_ID || null,
  facebook: process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET ? process.env.FACEBOOK_APP_ID : null,
});

const getJson = async (url, headers = {}) => {
  let res;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  } catch {
    throw new ApiError(502, 'Could not reach the sign-in provider. Please try again.');
  }
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
};

const invalidToken = () => new ApiError(400, 'Sign-in could not be verified. Please try again.');

const verifyGoogle = async (accessToken) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new ApiError(503, 'Google sign-in is not set up yet.');

  // 1. Was this token issued to OUR app, and is the email verified?
  const info = await getJson(
    `https://oauth2.googleapis.com/tokeninfo?${new URLSearchParams({ access_token: accessToken })}`
  );
  if (!info.ok || (info.data.aud !== clientId && info.data.azp !== clientId)) throw invalidToken();
  if (String(info.data.email_verified) !== 'true' || !info.data.email) {
    throw new ApiError(400, 'Your Google email is not verified.');
  }

  // 2. The display name (only used when creating a new account).
  const profile = await getJson('https://www.googleapis.com/oauth2/v3/userinfo', {
    Authorization: `Bearer ${accessToken}`,
  });

  return {
    email: String(info.data.email).toLowerCase(),
    name: (profile.ok && profile.data.name) || String(info.data.email).split('@')[0],
  };
};

const verifyFacebook = async (accessToken) => {
  const appId = process.env.FACEBOOK_APP_ID;
  const secret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !secret) throw new ApiError(503, 'Facebook sign-in is not set up yet.');

  // 1. Was this token issued to OUR app and still valid?
  const debug = await getJson(
    `https://graph.facebook.com/debug_token?${new URLSearchParams({
      input_token: accessToken,
      access_token: `${appId}|${secret}`,
    })}`
  );
  const meta = debug.data && debug.data.data;
  if (!debug.ok || !meta || !meta.is_valid || String(meta.app_id) !== String(appId)) throw invalidToken();

  // 2. Who is it?
  const me = await getJson(
    `https://graph.facebook.com/me?${new URLSearchParams({ fields: 'id,name,email', access_token: accessToken })}`
  );
  if (!me.ok || !me.data.id) throw invalidToken();
  if (!me.data.email) {
    throw new ApiError(400, 'Your Facebook account has no email address, so it cannot be used here.');
  }

  return { email: String(me.data.email).toLowerCase(), name: me.data.name || String(me.data.email).split('@')[0] };
};

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  permissions: user.permissions,
});

// mode 'login'  : only for an account that already exists (matched by email).
// mode 'signup' : creates a normal pending account (the super admin still has to approve it).
const socialAuth = async ({ provider, token, mode }, meta = {}) => {
  if (!PROVIDERS.includes(provider)) throw new ApiError(400, 'Unknown sign-in provider');
  if (mode !== 'login' && mode !== 'signup') throw new ApiError(400, 'Invalid request');
  if (typeof token !== 'string' || !token || token.length > 4096) throw invalidToken();

  const profile = provider === 'google' ? await verifyGoogle(token) : await verifyFacebook(token);
  const user = await User.findOne({ email: exactRegex(profile.email) });
  const label = provider === 'google' ? 'Google' : 'Facebook';

  if (mode === 'login') {
    if (!user) {
      recordAudit({ action: 'LOGIN_FAILED', outcome: 'failed', meta, details: { provider, reason: 'no account' } });
      throw new ApiError(404, `No account found for ${profile.email}. Please sign up first.`);
    }
    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      throw new ApiError(429, `This account is locked. Try again in ${minutesLeft} minute(s).`);
    }
    recordAudit({ action: 'LOGIN_SUCCESS', user, meta, details: { provider } });
    return { message: `Signed in with ${label}`, token: signToken(user), user: publicUser(user) };
  }

  // signup
  if (user) throw new ApiError(400, 'Email already registered. Please sign in instead.');

  const newUser = await User.create({
    name: profile.name.slice(0, 100),
    email: profile.email,
    // Nobody knows this password. The person can set one later with "Forgot Password".
    password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
    role: 'employee', // never a super admin from here
    status: 'pending',
    permissions: [],
  });
  recordAudit({ action: 'SIGNUP', user: newUser, meta, details: { provider } });

  return {
    message: 'Account created. Waiting for admin approval.',
    token: signToken(newUser),
    user: publicUser(newUser),
  };
};

module.exports = { socialAuth, getConfig };
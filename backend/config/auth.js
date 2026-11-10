// Everything about the login session lives here, so the cookie rules are
// defined in ONE place (login sets the cookie, logout clears it, the auth
// middleware reads it).
//
// The JWT is kept in an httpOnly cookie instead of localStorage: JavaScript on
// the page (including injected XSS code) can no longer read or steal it.
const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'xpendly_token';
const TOKEN_TTL_SECONDS = 8 * 60 * 60; // 8 hours

const MIN_JWT_SECRET_LENGTH = 32;

// Cookie settings come from .env so the same code works on localhost and live:
//   COOKIE_SECURE   -> "true" on HTTPS (defaults to true when NODE_ENV=production)
//   COOKIE_SAMESITE -> lax (default) | strict | none
//     - lax/strict: frontend and API are on the SAME site (e.g. app.uni.lk + api.uni.lk,
//       or localhost + localhost). This is the safe default.
//     - none: only if the frontend and API are on totally different domains.
//       Requires COOKIE_SECURE=true (HTTPS).
const cookieOptions = () => {
  const sameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  const secure =
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: sameSite === 'none' ? true : secure,
    sameSite,
    path: '/',
  };
};

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_TTL_SECONDS,
  });

const setAuthCookie = (res, token) => {
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: TOKEN_TTL_SECONDS * 1000 });
};

const clearAuthCookie = (res) => {
  // The options (path, sameSite, secure) must match the ones used when the
  // cookie was set, otherwise the browser keeps the old cookie.
  res.clearCookie(COOKIE_NAME, cookieOptions());
};

module.exports = {
  COOKIE_NAME,
  TOKEN_TTL_SECONDS,
  MIN_JWT_SECRET_LENGTH,
  signToken,
  setAuthCookie,
  clearAuthCookie,
};
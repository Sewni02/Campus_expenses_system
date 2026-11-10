// Extra protection against CSRF (another website making the browser send a
// request with the user's login cookie).
//
// The cookie already uses SameSite, and CORS only allows FRONTEND_URL. This
// adds a third, simple rule: if a browser sends an Origin header on a
// create / edit / delete request, it must be our own frontend.
//
// Requests with NO Origin header (curl, Postman, server-to-server) are let
// through: they are not CSRF, and they still need a valid login anyway.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const normalize = (url) => String(url || '').trim().replace(/\/+$/, '').toLowerCase();

const requireTrustedOrigin = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.headers.origin;
  if (!origin) return next();

  if (normalize(origin) === normalize(process.env.FRONTEND_URL)) return next();

  return res.status(403).json({ message: 'Request blocked: untrusted origin.' });
};

module.exports = { requireTrustedOrigin };
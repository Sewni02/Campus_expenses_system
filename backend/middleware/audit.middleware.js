const { recordAudit, requestMeta } = require('../utils/audit');

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Mounted ONCE in server.js. After every response it checks: was this a
// create / edit / delete by a logged-in user? If yes, it adds a line to the
// audit log (who, what route, which ids, did it work).
//
// Because it is mounted globally, a route added later is covered automatically.
//
// Not logged here on purpose:
//   - GET requests (reading is not a change)
//   - requests with no logged-in user (login / signup are logged by the auth service)
//   - request bodies (they can contain passwords or bank details)
const auditRequests = (req, res, next) => {
  if (!WRITE_METHODS.has(req.method)) return next();

  res.on('finish', () => {
    if (!req.user) return;
    // Login / logout / reset write their own, more specific audit rows.
    if (req.baseUrl === '/api/auth') return;

    // "/api/hardware" + "/:id/payments/:paymentId" - the route PATTERN, so all
    // deletes of the same kind group together in the log.
    const routePattern = `${req.baseUrl}${req.route?.path === '/' ? '' : req.route?.path || ''}`;

    recordAudit({
      action: `${req.method} ${routePattern || req.originalUrl.split('?')[0]}`,
      outcome: res.statusCode < 400 ? 'success' : 'failed',
      user: req.user,
      meta: requestMeta(req),
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: res.statusCode,
      details: { params: req.params },
    });
  });

  next();
};

module.exports = { auditRequests };
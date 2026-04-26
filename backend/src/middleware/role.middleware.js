'use strict';

/**
 * Role-based access control middleware.
 * Usage: router.post('/payouts', auth, tenant, requireRole('president', 'treasurer'), handler)
 *
 * Role hierarchy (highest → lowest):
 *   president → treasurer → secretary → member
 *
 * @task Dev A — Task A-04
 */
const requireRole = (...allowedRoles) => (req, res, next) => {
  const userRole = req.membership?.role || req.user?.role;

  if (!userRole || !allowedRoles.includes(userRole)) {
    return res.status(403).json({
      error: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
      code: 'INSUFFICIENT_PERMISSIONS',
    });
  }

  next();
};

module.exports = { requireRole };

'use strict';

/**
 * Middleware to restrict route access to platform administrators.
 * Must be applied after authMiddleware.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({
      error: 'Access denied. Platform Administrator privileges required.',
      code: 'ADMIN_REQUIRED',
    });
  }
  next();
};

module.exports = requireAdmin;

'use strict';

const jwt = require('jsonwebtoken');

/**
 * Verifies the Bearer JWT from the Authorization header.
 * Attaches decoded payload to req.user on success.
 * Returns 401 if the token is missing, invalid, or expired.
 *
 * @task Dev A — Task A-04
 */
const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required. Include a Bearer token in the Authorization header.',
      code: 'MISSING_TOKEN',
    });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      error: expired ? 'Session expired. Please log in again.' : 'Invalid token.',
      code: expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
    });
  }
};

module.exports = authMiddleware;

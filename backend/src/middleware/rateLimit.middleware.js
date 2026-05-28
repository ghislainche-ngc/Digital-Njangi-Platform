'use strict';

const buckets = new Map();

function createRateLimiter({ windowMs, limit, message }) {
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error('windowMs must be a positive number');
  }
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error('limit must be a positive number');
  }

  return (req, res, next) => {
    const key = `${req.ip || req.headers['x-forwarded-for'] || 'unknown'}:${req.originalUrl}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= limit) {
      res.set('Retry-After', Math.ceil((bucket.resetAt - now) / 1000).toString());
      return res.status(429).json({
        error: message || 'Too many requests. Please try again later.',
        code: 'RATE_LIMITED',
      });
    }

    bucket.count += 1;
    buckets.set(key, bucket);
    return next();
  };
}

module.exports = { createRateLimiter };
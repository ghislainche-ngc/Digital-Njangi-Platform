'use strict';

/**
 * Global error handler — must be registered LAST in app.js.
 * Converts all unhandled errors into a standard JSON error shape.
 *
 * All errors must follow this shape:
 *   { error: "Human readable message", code: "MACHINE_CODE", field?: "optional" }
 */
// eslint-disable-next-line no-unused-vars
const errorMiddleware = (err, req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error('[NAAS Error]', err);

  // Joi / Zod validation errors
  if (err.isJoi || err.name === 'ValidationError') {
    return res.status(400).json({
      error: err.details?.[0]?.message || err.message,
      code: 'VALIDATION_ERROR',
      field: err.details?.[0]?.path?.[0],
    });
  }

  // JWT errors (should be caught by authMiddleware, but just in case)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Invalid or expired token.', code: 'AUTH_ERROR' });
  }

  // Supabase unique constraint violations
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Resource already exists.', code: 'DUPLICATE' });
  }

  // Default 500
  const isDev = process.env.NODE_ENV === 'development';
  return res.status(500).json({
    error: 'An unexpected error occurred.',
    code: 'INTERNAL_ERROR',
    ...(isDev && { detail: err.message, stack: err.stack }),
  });
};

module.exports = errorMiddleware;

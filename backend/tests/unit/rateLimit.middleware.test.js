'use strict';

const { createRateLimiter } = require('../../src/middleware/rateLimit.middleware');

describe('createRateLimiter', () => {
  it('allows requests up to the limit and then returns 429', () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      limit: 1,
      message: 'Too many requests.',
    });

    const next = jest.fn();
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn(),
    };

    const req = {
      ip: '127.0.0.1',
      originalUrl: '/auth/login',
      headers: {},
    };

    limiter(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    limiter(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'RATE_LIMITED',
    }));
  });
});
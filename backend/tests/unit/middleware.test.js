'use strict';

const jwt = require('jsonwebtoken');
const authMiddleware = require('../../src/middleware/auth.middleware');
const { requireRole } = require('../../src/middleware/role.middleware');

const SECRET = 'test_secret_at_least_32_chars_long';
process.env.JWT_SECRET = SECRET;

function mockReqRes() {
  const req = { headers: {} };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('authMiddleware', () => {
  it('returns 401 when no Authorization header', () => {
    const { req, res, next } = mockReqRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid token', () => {
    const { req, res, next } = mockReqRes();
    req.headers.authorization = 'Bearer invalid.token.here';
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for expired token', () => {
    const token = jwt.sign({ sub: 'user1' }, SECRET, { expiresIn: -1 });
    const { req, res, next } = mockReqRes();
    req.headers.authorization = `Bearer ${token}`;
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_EXPIRED' }));
  });

  it('calls next() and sets req.user for valid token', () => {
    const token = jwt.sign({ sub: 'user1', email: 'a@b.com' }, SECRET);
    const { req, res, next } = mockReqRes();
    req.headers.authorization = `Bearer ${token}`;
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.sub).toBe('user1');
  });
});

describe('requireRole middleware', () => {
  it('returns 403 when user has wrong role', () => {
    const { req, res, next } = mockReqRes();
    req.membership = { role: 'member' };
    requireRole('president', 'treasurer')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('calls next() when user has required role', () => {
    const { req, res, next } = mockReqRes();
    req.membership = { role: 'treasurer' };
    requireRole('president', 'treasurer')(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

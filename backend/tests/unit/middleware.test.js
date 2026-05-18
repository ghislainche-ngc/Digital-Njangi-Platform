'use strict';

const jwt = require('jsonwebtoken');
const authMiddleware = require('../../src/middleware/auth.middleware');
const { requireRole } = require('../../src/middleware/role.middleware');

const SECRET = 'test_secret_at_least_32_chars_long';
process.env.JWT_SECRET = SECRET;
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

function mockReqRes() {
  const req = { headers: {}, params: {} };
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

  it('returns 403 when no role present', () => {
    const { req, res, next } = mockReqRes();
    requireRole('president')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('tenantMiddleware', () => {
  let tenantMiddleware;
  let mockSupabase;

  beforeEach(() => {
    jest.resetModules();

    mockSupabase = {
      from: jest.fn(),
    };

    jest.mock('../../src/config/supabase', () => ({
      supabase: mockSupabase,
    }));

    tenantMiddleware = require('../../src/middleware/tenant.middleware');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls next() without query when no groupId param', async () => {
    const { req, res, next } = mockReqRes();
    req.user = { sub: 'user-1' };

    await tenantMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns 403 when user is not a member of the group', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const { req, res, next } = mockReqRes();
    req.params = { groupId: 'group-abc' };
    req.user = { sub: 'user-outsider' };

    await tenantMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NOT_A_MEMBER' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('sets req.group and req.membership when user is a member', async () => {
    const mockGroup = { id: 'group-abc', name: 'Test Group' };
    const mockMembership = {
      id: 'mem-1',
      user_id: 'user-1',
      group_id: 'group-abc',
      role: 'president',
      njangi_groups: mockGroup,
    };

    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockMembership, error: null }),
    };
    mockSupabase.from.mockReturnValue(chain);

    const { req, res, next } = mockReqRes();
    req.params = { groupId: 'group-abc' };
    req.user = { sub: 'user-1' };

    await tenantMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.group).toEqual(mockGroup);
    expect(req.membership.role).toBe('president');
  });
});

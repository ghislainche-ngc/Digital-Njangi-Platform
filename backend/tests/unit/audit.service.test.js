'use strict';

const { AuditService, AuditEvents } = require('../../src/services/audit/AuditService');

/**
 * Unit tests for AuditService — mock-first, no real DB.
 *
 * Core rule under test: log() must NEVER throw or reject, regardless of
 * what the underlying supabase client does.
 */

/**
 * Build a fake supabase client whose insert() behaviour is configurable.
 * @param {object} opts
 * @param {*} [opts.resolveValue] — value insert() resolves to (default { error: null })
 * @param {Error} [opts.rejectWith] — if set, insert() rejects with this error
 * @returns {{ client: object, insert: jest.Mock, from: jest.Mock }}
 */
function makeFakeSupabase(opts = {}) {
  const insert = jest.fn(() => {
    if (opts.rejectWith) {
      return Promise.reject(opts.rejectWith);
    }
    return Promise.resolve(
      Object.prototype.hasOwnProperty.call(opts, 'resolveValue')
        ? opts.resolveValue
        : { error: null }
    );
  });
  const from = jest.fn(() => ({ insert }));
  return { client: { from }, insert, from };
}

describe('AuditService.log()', () => {
  let errorSpy;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('inserts a record into audit_events with the correct fields', async () => {
    const { client, from, insert } = makeFakeSupabase();
    const service = new AuditService(client);

    await service.log('group-1', 'user-1', AuditEvents.PAYOUT_EXECUTED, { amount: 5000 });

    expect(from).toHaveBeenCalledWith('audit_events');
    expect(insert).toHaveBeenCalledWith({
      group_id: 'group-1',
      user_id: 'user-1',
      event_type: 'PAYOUT_EXECUTED',
      payload: { amount: 5000 },
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('defaults payload to an empty object when omitted', async () => {
    const { client, insert } = makeFakeSupabase();
    const service = new AuditService(client);

    await service.log('group-2', 'user-2', AuditEvents.FINE_WAIVED);

    expect(insert).toHaveBeenCalledWith({
      group_id: 'group-2',
      user_id: 'user-2',
      event_type: 'FINE_WAIVED',
      payload: {},
    });
  });

  it('does NOT throw when insert resolves with an error object', async () => {
    const { client } = makeFakeSupabase({
      resolveValue: { error: { message: 'duplicate key value' } },
    });
    const service = new AuditService(client);

    await expect(
      service.log('group-3', 'user-3', AuditEvents.SOCIAL_FUND_DEPOSIT, { amount: 100 })
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      '[Audit] Failed to log event:',
      'duplicate key value'
    );
  });

  it('does NOT throw or reject when insert() itself rejects with an Error', async () => {
    const { client } = makeFakeSupabase({
      rejectWith: new Error('network unreachable'),
    });
    const service = new AuditService(client);

    await expect(
      service.log('group-4', 'user-4', AuditEvents.FINE_PAID, { amount: 250 })
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      '[Audit] Failed to log event:',
      'network unreachable'
    );
  });
});

describe('AuditEvents constants', () => {
  it('is exported and contains the expected event types', () => {
    expect(AuditEvents).toBeDefined();
    expect(AuditEvents.FINE_WAIVED).toBe('FINE_WAIVED');
    expect(AuditEvents.PAYOUT_EXECUTED).toBe('PAYOUT_EXECUTED');
    expect(AuditEvents.SOCIAL_FUND_DEPOSIT).toBe('SOCIAL_FUND_DEPOSIT');
  });
});

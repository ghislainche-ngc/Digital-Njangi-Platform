'use strict';

const { detectOperatorFromPhone, resolvePayoutGateway } = require('../../src/services/payment/phoneRouter');

describe('phoneRouter.detectOperatorFromPhone', () => {
  const MTN_SAMPLES = [
    '+237672345678', '+237650123456', '+237651987654', '+237652000001',
    '+237653555555', '+237654111111', '+237680222222', '+237681333333',
    '+237682444444', '+237683555555', '+237684666666',
  ];
  const ORANGE_SAMPLES = [
    '+237692345678', '+237655123456', '+237656987654', '+237657000001',
    '+237658555555', '+237659111111', '+237685222222', '+237686333333',
    '+237687444444', '+237688555555', '+237689666666',
  ];

  it.each(MTN_SAMPLES)('classifies %s as mtn', (phone) => {
    expect(detectOperatorFromPhone(phone)).toBe('mtn');
  });

  it.each(ORANGE_SAMPLES)('classifies %s as orange', (phone) => {
    expect(detectOperatorFromPhone(phone)).toBe('orange');
  });

  it('returns null for non-Cameroon prefixes', () => {
    expect(detectOperatorFromPhone('+233241234567')).toBeNull();
    expect(detectOperatorFromPhone('+234801234567')).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(detectOperatorFromPhone('')).toBeNull();
    expect(detectOperatorFromPhone('not-a-number')).toBeNull();
    expect(detectOperatorFromPhone('+237')).toBeNull();
    expect(detectOperatorFromPhone(null)).toBeNull();
    expect(detectOperatorFromPhone(undefined)).toBeNull();
  });
});

describe('phoneRouter.resolvePayoutGateway', () => {
  it('returns mtn_momo for MTN numbers', () => {
    expect(resolvePayoutGateway('+237672345678')).toBe('mtn_momo');
  });

  it('returns orange_money for Orange numbers', () => {
    expect(resolvePayoutGateway('+237692345678')).toBe('orange_money');
  });

  it('throws .statusCode=400 on unknown prefix', () => {
    expect(() => resolvePayoutGateway('+233241234567'))
      .toThrow(expect.objectContaining({
        message: expect.stringContaining('Unrecognized phone prefix'),
        statusCode: 400,
      }));
  });

  it('never returns "campay" — that value is reserved for explicit column setting', () => {
    expect(['mtn_momo', 'orange_money']).toContain(resolvePayoutGateway('+237672000001'));
    expect(['mtn_momo', 'orange_money']).toContain(resolvePayoutGateway('+237692000001'));
  });
});

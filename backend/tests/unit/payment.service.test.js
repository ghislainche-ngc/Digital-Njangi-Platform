'use strict';

const PaymentProvider = require('../../src/services/payment/PaymentProvider');
const MTNMoMoService = require('../../src/services/payment/MTNMoMoService');
const OrangeMoneyService = require('../../src/services/payment/OrangeMoneyService');
const { getProvider } = require('../../src/services/payment/index');

/**
 * Unit tests for PaymentProvider OOP hierarchy.
 * These tests verify the architecture — they do NOT call the real MoMo API.
 *
 * @task Dev D — Task D-01 (infrastructure) / Dev B verifies implementations
 */

describe('PaymentProvider (abstract class)', () => {
  it('cannot be instantiated directly', () => {
    expect(() => new PaymentProvider({})).toThrow('abstract');
  });
});

describe('MTNMoMoService', () => {
  it('extends PaymentProvider', () => {
    const service = new MTNMoMoService({ subscriptionKey: 'x', apiUser: 'y', apiKey: 'z' });
    expect(service).toBeInstanceOf(PaymentProvider);
  });
});

describe('OrangeMoneyService', () => {
  it('extends PaymentProvider', () => {
    const service = new OrangeMoneyService({ apiKey: 'x' });
    expect(service).toBeInstanceOf(PaymentProvider);
  });
});

describe('getProvider factory', () => {
  it('returns MTNMoMoService for mtn_momo', () => {
    const provider = getProvider('mtn_momo');
    expect(provider).toBeInstanceOf(MTNMoMoService);
  });

  it('returns OrangeMoneyService for orange_money', () => {
    const provider = getProvider('orange_money');
    expect(provider).toBeInstanceOf(OrangeMoneyService);
  });

  it('throws for unknown gateway', () => {
    expect(() => getProvider('paypal')).toThrow('Unknown payment gateway');
  });
});

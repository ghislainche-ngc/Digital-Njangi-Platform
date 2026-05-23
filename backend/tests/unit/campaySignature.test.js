'use strict';

const jwt = require('jsonwebtoken');
const { verifyWebhookSignature } = require('../../src/services/payment/campaySignature');

const KEY = 'test-webhook-key-32-bytes-minimum-for-hs256-to-be-comfortable';
const WRONG_KEY = 'different-key-still-long-enough-for-hs256-purposes-here';

describe('campaySignature.verifyWebhookSignature', () => {
  it('returns the decoded payload when the signature is valid', () => {
    const payload = { reference: 'abc', status: 'SUCCESSFUL' };
    const token = jwt.sign(payload, KEY, { algorithm: 'HS256' });

    const result = verifyWebhookSignature(token, KEY);
    expect(result).toMatchObject(payload);
  });

  it('returns null when the signature is signed with a different key', () => {
    const token = jwt.sign({ reference: 'abc' }, WRONG_KEY, { algorithm: 'HS256' });
    expect(verifyWebhookSignature(token, KEY)).toBeNull();
  });

  it('returns null for a tampered token', () => {
    const token = jwt.sign({ reference: 'abc' }, KEY, { algorithm: 'HS256' });
    const tampered = token.slice(0, -2) + 'XX';
    expect(verifyWebhookSignature(tampered, KEY)).toBeNull();
  });

  it('returns null for a non-JWT string', () => {
    expect(verifyWebhookSignature('not-a-jwt', KEY)).toBeNull();
  });

  it('returns null for empty signature', () => {
    expect(verifyWebhookSignature('', KEY)).toBeNull();
  });

  it('returns null for undefined signature', () => {
    expect(verifyWebhookSignature(undefined, KEY)).toBeNull();
  });

  it('returns null when webhookKey is empty or missing', () => {
    const token = jwt.sign({ reference: 'abc' }, KEY, { algorithm: 'HS256' });
    expect(verifyWebhookSignature(token, '')).toBeNull();
    expect(verifyWebhookSignature(token, undefined)).toBeNull();
    expect(verifyWebhookSignature(token, null)).toBeNull();
  });

  it('rejects an alg:none token whose pin would otherwise be bypassed (algorithm confusion guard)', () => {
    // Build an alg:none token WITH a non-empty signature segment so the
    // algorithm-pinning check is the gate that rejects it (not the
    // "signature required" check that fires when the segment is empty).
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ reference: 'abc' })).toString('base64url');
    const fakeSig = Buffer.from('not-a-real-signature').toString('base64url');
    const algNoneToken = `${header}.${payload}.${fakeSig}`;
    expect(verifyWebhookSignature(algNoneToken, KEY)).toBeNull();
  });
});

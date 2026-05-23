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

  it('rejects tokens signed with a non-HS256 algorithm (algorithm confusion guard)', () => {
    // 'none' algorithm token — a classic JWT vulnerability if not pinned.
    const noneToken = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
      + '.'
      + Buffer.from(JSON.stringify({ reference: 'abc' })).toString('base64url')
      + '.';
    expect(verifyWebhookSignature(noneToken, KEY)).toBeNull();
  });
});

# Campay Payment Gateway — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Campay as a third `PaymentProvider` subclass with full `charge` / `disburse` / `getStatus` support, a JWT-verifying webhook, a per-group `preferred_payout_gateway` column with two-tier payout routing, and a new admin endpoint pair.

**Architecture:** Server-side HTTP integration with Campay's REST API (`/api/token/`, `/api/collect/`, `/api/transaction/<ref>/`, `/api/withdraw/`). Dual-path completion: synchronous polling inside `CampayService` plus an asynchronous webhook (`POST/GET /payments/campay/notify`) whose JWT signature is verified with `CAMPAY_WEBHOOK_KEY`. Routing decisions remain split: collection rail is the existing `njangi_groups.preferred_gateway`, while payout rail is the new nullable `preferred_payout_gateway` (when null, fall back to phone-prefix routing via the new `phoneRouter` utility).

**Tech Stack:** Node.js + Express, Supabase (Postgres + RLS), Jest (London-school mocks), `jsonwebtoken` (already in deps), `joi` (already in deps), native `fetch`.

**Spec:** [docs/superpowers/specs/2026-05-23-campay-gateway-design.md](../specs/2026-05-23-campay-gateway-design.md) at commit `6ed3a7d`.

**Branch:** `feature/dev-b/campay-gateway` (already created from main).

**URL prefix note:** Spec sections occasionally write `/api/groups/...`. The repo's `app.js` mounts routes WITHOUT an `/api` prefix (e.g. `app.use('/groups', groupRoutes)`). All paths in this plan use the actual mount layout: `/groups/:groupId/gateway`, `/groups/:groupId/payout-gateway`, `/payments/campay/notify`. If a reverse proxy adds `/api` in front, that's an infra concern outside this work.

---

## File Structure

### New files (12)

| Path | Responsibility |
| --- | --- |
| `backend/src/services/payment/phoneRouter.js` | Pure functions: detect Cameroon operator from phone, resolve payout gateway by prefix. |
| `backend/src/services/payment/CampayService.js` | Third `PaymentProvider` subclass: token cache + `/collect/`, `/withdraw/`, `/transaction/` calls. |
| `backend/src/services/payment/campaySignature.js` | One pure function: verify Campay webhook JWT against `CAMPAY_WEBHOOK_KEY`. |
| `backend/src/modules/payments/payments.routes.js` | Webhook router (`GET`/`POST` for `/payments/campay/notify`). |
| `backend/src/modules/payments/payments.controller.js` | Webhook handler — verify signature, dispatch to service. |
| `backend/src/modules/payments/payments.service.js` | Idempotent ledger updates dispatched by `endpoint` field (`collect` → contributions; `withdraw` → payouts). |
| `backend/src/config/migrations/2026-05-23-add-preferred-gateway.sql` | DDL: add `preferred_gateway` and `preferred_payout_gateway` to `njangi_groups`. |
| `backend/tests/unit/phoneRouter.test.js` | Table-driven prefix tests. |
| `backend/tests/unit/campaySignature.test.js` | JWT verify happy/sad paths. |
| `backend/tests/unit/payments.service.test.js` | Idempotency + dispatch tests for `applyTerminalStatus`. |
| `backend/tests/integration/campay.webhook.integration.test.js` | End-to-end webhook integration test. |
| `docs/smoke-tests/campay.md` | Manual pre-demo checklist. |

### Modified files (11)

| Path | Change |
| --- | --- |
| `backend/src/services/payment/index.js` | Add `campay` config block + `case 'campay':` to factory. |
| `backend/.env.example` | Add `CAMPAY_APP_USERNAME`, `CAMPAY_APP_PASSWORD`, `CAMPAY_WEBHOOK_KEY`, `CAMPAY_BASE_URL`, `CAMPAY_NOTIFY_URL`. |
| `backend/src/config/schema.sql` | Reflect the new columns so fresh setups have them. |
| `backend/src/services/audit/AuditService.js` | Add two `AuditEvents` constants: `GATEWAY_CHANGED`, `PAYOUT_GATEWAY_CHANGED`. |
| `backend/src/modules/groups/group.service.js` | Add `updateGateway` + `updatePayoutGateway`. |
| `backend/src/modules/groups/group.controller.js` | Add `updateGateway` + `updatePayoutGateway` controllers. |
| `backend/src/modules/groups/group.validation.js` | Add `updateGatewaySchema` + `updatePayoutGatewaySchema`. |
| `backend/src/modules/groups/group.routes.js` | Add two `PATCH` routes with Swagger annotations. |
| `backend/src/engines/PayoutEngine.js` | Constructor: `paymentProvider` → `paymentFactory`. `execute` step 2: two-tier resolution. |
| `backend/src/app.js` | Mount the new payments router at `/payments`. |
| `backend/tests/unit/payment.service.test.js` | Add Campay tests + factory `campay` case test. |
| `backend/tests/unit/group.service.test.js` | Add tests for `updateGateway` + `updatePayoutGateway`. |
| `backend/tests/unit/payout.service.test.js` | Update PayoutEngine wiring; add two-tier routing matrix. |
| `backend/tests/integration/group.api.test.js` | Add integration tests for both new PATCH endpoints. |

---

## Task 1: phoneRouter — Cameroon MSISDN routing utility

**Files:**
- Create: `backend/src/services/payment/phoneRouter.js`
- Create: `backend/tests/unit/phoneRouter.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/phoneRouter.test.js`:

```js
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
    // Sanity check: for any valid Cameroon number, payout gateway is always one of these two
    expect(['mtn_momo', 'orange_money']).toContain(resolvePayoutGateway('+237672000001'));
    expect(['mtn_momo', 'orange_money']).toContain(resolvePayoutGateway('+237692000001'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `backend/`:

```bash
npx jest tests/unit/phoneRouter.test.js
```

Expected: FAIL with `Cannot find module '../../src/services/payment/phoneRouter'`.

- [ ] **Step 3: Write the implementation**

Create `backend/src/services/payment/phoneRouter.js`:

```js
'use strict';

// Cameroon MSISDN prefix tables. Source: Monetbil operators table (p.10)
// and corroborated by Campay's auto-detect behavior. Longest prefix wins.
const MTN_PREFIXES = ['650', '651', '652', '653', '654',
                      '680', '681', '682', '683', '684', '67'];
const ORANGE_PREFIXES = ['655', '656', '657', '658', '659',
                         '685', '686', '687', '688', '689', '69'];

// Sort descending by length so 3-char prefixes match before 2-char ones.
const SORTED_MTN = [...MTN_PREFIXES].sort((a, b) => b.length - a.length);
const SORTED_ORANGE = [...ORANGE_PREFIXES].sort((a, b) => b.length - a.length);

/**
 * Detect the Cameroon mobile operator from an E.164 phone number.
 * @param {string} phone — expected format: '+237<prefix><subscriber>'
 * @returns {'mtn' | 'orange' | null}
 */
function detectOperatorFromPhone(phone) {
  if (typeof phone !== 'string') return null;
  if (!phone.startsWith('+237')) return null;
  const local = phone.slice(4); // strip '+237'
  if (local.length === 0) return null;

  if (SORTED_MTN.some(p => local.startsWith(p))) return 'mtn';
  if (SORTED_ORANGE.some(p => local.startsWith(p))) return 'orange';
  return null;
}

/**
 * Resolve which payout gateway to use based on the recipient's phone prefix.
 * Never returns 'campay' — that value is only reachable via an explicit
 * preferred_payout_gateway column setting in njangi_groups.
 *
 * @param {string} phone
 * @returns {'mtn_momo' | 'orange_money'}
 * @throws {Error} .statusCode=400 if the prefix is not recognized
 */
function resolvePayoutGateway(phone) {
  const operator = detectOperatorFromPhone(phone);
  if (operator === 'mtn') return 'mtn_momo';
  if (operator === 'orange') return 'orange_money';

  const err = new Error(`Unrecognized phone prefix for payout routing: ${phone}`);
  err.statusCode = 400;
  throw err;
}

module.exports = { detectOperatorFromPhone, resolvePayoutGateway };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/unit/phoneRouter.test.js
```

Expected: PASS, all cases green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/payment/phoneRouter.js backend/tests/unit/phoneRouter.test.js
git commit -m "feat(payments): add phoneRouter utility for Cameroon operator detection"
```

---

## Task 2: campaySignature — JWT webhook signature verifier

**Files:**
- Create: `backend/src/services/payment/campaySignature.js`
- Create: `backend/tests/unit/campaySignature.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/campaySignature.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/campaySignature.test.js
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Write the implementation**

Create `backend/src/services/payment/campaySignature.js`:

```js
'use strict';

const jwt = require('jsonwebtoken');

/**
 * Verify a Campay webhook signature.
 *
 * Per Campay docs: the `signature` field on every payment notification is a JWT
 * signed with the app's webhook key (HS256, same scheme as the /token/ endpoint).
 * We pin the algorithm to prevent 'none' / algorithm confusion attacks.
 *
 * @param {string} signature   The 'signature' field from the webhook payload.
 * @param {string} webhookKey  Value of CAMPAY_WEBHOOK_KEY.
 * @returns {object|null}      Decoded JWT payload on success, null on any failure.
 */
function verifyWebhookSignature(signature, webhookKey) {
  if (!signature || typeof signature !== 'string') return null;
  if (!webhookKey || typeof webhookKey !== 'string') return null;
  try {
    return jwt.verify(signature, webhookKey, { algorithms: ['HS256'] });
  } catch (_err) {
    return null;
  }
}

module.exports = { verifyWebhookSignature };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/unit/campaySignature.test.js
```

Expected: PASS, including the algorithm-confusion guard.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/payment/campaySignature.js backend/tests/unit/campaySignature.test.js
git commit -m "feat(payments): add campaySignature module for JWT webhook verification"
```

---

## Task 3: Env vars + audit constants

**Files:**
- Modify: `backend/.env.example`
- Modify: `backend/src/services/audit/AuditService.js`

- [ ] **Step 1: Update `.env.example`**

Append to `backend/.env.example`:

```
# ─── Campay payment gateway (https://campay.net) ──────────────────────────
# Credentials come from the Campay dashboard after creating an app.
# USERNAME + PASSWORD are used to obtain a 1-hour JWT from POST /api/token/.
# WEBHOOK_KEY is the separate signing key used to verify webhook authenticity.
# Never commit real values — they live in backend/.env (gitignored).
CAMPAY_APP_USERNAME=
CAMPAY_APP_PASSWORD=
CAMPAY_WEBHOOK_KEY=

# Base URL. Sandbox default; override only for production.
CAMPAY_BASE_URL=https://demo.campay.net/api

# Public URL Campay will GET (or POST) payment notifications to. Configure
# the same value + method in the Campay dashboard. Must be reachable from
# Campay's servers — use the Contabo VPS hostname for demo, or ngrok locally.
CAMPAY_NOTIFY_URL=https://your-naas-host.example.com/payments/campay/notify
```

- [ ] **Step 2: Add audit event constants**

Edit `backend/src/services/audit/AuditService.js`. Inside the `AuditEvents` object, after `GROUP_SETTINGS_CHANGED`, add:

```js
  GATEWAY_CHANGED:                'GATEWAY_CHANGED',
  PAYOUT_GATEWAY_CHANGED:         'PAYOUT_GATEWAY_CHANGED',
  PAYOUT_FAILED:                  'PAYOUT_FAILED',
```

The full `AuditEvents` object after the edit:

```js
const AuditEvents = {
  CONTRIBUTION_CONFIRMED:         'CONTRIBUTION_CONFIRMED',
  CONTRIBUTION_FAILED:            'CONTRIBUTION_FAILED',
  CASH_PAYMENT_RECORDED:          'CASH_PAYMENT_RECORDED',
  PAYOUT_EXECUTED:                'PAYOUT_EXECUTED',
  PAYOUT_BLOCKED:                 'PAYOUT_BLOCKED',
  PAYOUT_FAILED:                  'PAYOUT_FAILED',
  FINE_APPLIED:                   'FINE_APPLIED',
  FINE_WAIVED:                    'FINE_WAIVED',
  FINE_PAID:                      'FINE_PAID',
  MEMBER_INVITED:                 'MEMBER_INVITED',
  MEMBER_JOINED:                  'MEMBER_JOINED',
  MEMBER_REMOVED:                 'MEMBER_REMOVED',
  ROLE_CHANGED:                   'ROLE_CHANGED',
  FRAUD_ALERT_SELF_CASH_PAYMENT:  'FRAUD_ALERT_SELF_CASH_PAYMENT',
  GROUP_SETTINGS_CHANGED:         'GROUP_SETTINGS_CHANGED',
  GATEWAY_CHANGED:                'GATEWAY_CHANGED',
  PAYOUT_GATEWAY_CHANGED:         'PAYOUT_GATEWAY_CHANGED',
  SOCIAL_FUND_DEPOSIT:            'SOCIAL_FUND_DEPOSIT',
  SOCIAL_FUND_WITHDRAWAL:         'SOCIAL_FUND_WITHDRAWAL',
  PDF_REPORT_GENERATED:           'PDF_REPORT_GENERATED',
};
```

- [ ] **Step 3: Verify existing tests still pass**

```bash
npx jest tests/unit/audit.service.test.js
```

Expected: PASS (the change is additive, no behavioral change).

- [ ] **Step 4: Commit**

```bash
git add backend/.env.example backend/src/services/audit/AuditService.js
git commit -m "chore(payments): add Campay env placeholders and audit event constants"
```

---

## Task 4: CampayService scaffold + factory case

**Files:**
- Create: `backend/src/services/payment/CampayService.js`
- Modify: `backend/src/services/payment/index.js`
- Modify: `backend/tests/unit/payment.service.test.js`

- [ ] **Step 1: Write the failing scaffold tests**

Append to `backend/tests/unit/payment.service.test.js` (after the existing `OrangeMoneyService` describe block):

```js
const CampayService = require('../../src/services/payment/CampayService');

describe('CampayService', () => {
  it('extends PaymentProvider', () => {
    const service = new CampayService({
      username: 'u', password: 'p', baseUrl: 'https://demo.campay.net/api',
    });
    expect(service).toBeInstanceOf(PaymentProvider);
  });

  it('normalizes a +237 phone to a 237-prefixed digit string', () => {
    const service = new CampayService({ username: 'u', password: 'p' });
    // Use a tiny escape hatch: _normalizePhone is private but reachable for testing
    expect(service._normalizePhone('+237677000001')).toBe('237677000001');
  });

  it('throws .statusCode=400 when _normalizePhone receives non-Cameroon input', () => {
    const service = new CampayService({ username: 'u', password: 'p' });
    expect(() => service._normalizePhone('+233241234567'))
      .toThrow(expect.objectContaining({ statusCode: 400 }));
  });

  it('refund() throws — Campay has no native refund', async () => {
    const service = new CampayService({ username: 'u', password: 'p' });
    await expect(service.refund('any-ref')).rejects.toThrow(/does not support native refunds/);
  });
});

describe('Payment factory — campay case', () => {
  const { getProvider } = require('../../src/services/payment/index');

  it('returns a CampayService when env vars are set', () => {
    const original = { ...process.env };
    process.env.CAMPAY_APP_USERNAME = 'u';
    process.env.CAMPAY_APP_PASSWORD = 'p';
    try {
      // index.js reads env at module load — re-require with fresh cache.
      jest.resetModules();
      const { getProvider: freshGetProvider } = require('../../src/services/payment/index');
      const provider = freshGetProvider('campay');
      expect(provider).toBeInstanceOf(CampayService);
    } finally {
      process.env = original;
      jest.resetModules();
    }
  });

  it('throws when CAMPAY_APP_USERNAME is unset', () => {
    const original = { ...process.env };
    delete process.env.CAMPAY_APP_USERNAME;
    delete process.env.CAMPAY_APP_PASSWORD;
    try {
      jest.resetModules();
      const { getProvider: freshGetProvider } = require('../../src/services/payment/index');
      expect(() => freshGetProvider('campay')).toThrow(/CAMPAY_APP_USERNAME/);
    } finally {
      process.env = original;
      jest.resetModules();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/payment.service.test.js
```

Expected: FAIL with `Cannot find module '../../src/services/payment/CampayService'`.

- [ ] **Step 3: Create the CampayService scaffold**

Create `backend/src/services/payment/CampayService.js`:

```js
'use strict';

const PaymentProvider = require('./PaymentProvider');
const { detectOperatorFromPhone } = require('./phoneRouter');

/**
 * CampayService — Cameroon mobile-money aggregator (https://campay.net).
 *
 * OOP Pillars:
 *   - Inheritance: extends PaymentProvider (abstract base).
 *   - Polymorphism: overrides charge(), disburse(), getStatus(), refund().
 *   - Encapsulation: private _getToken / _pollStatus / _normalizePhone.
 *   - Abstraction: callers use charge(phone, amount, ref) without knowing
 *     about Campay's JWT auth, token caching, or polling internals.
 */
class CampayService extends PaymentProvider {
  constructor(config) {
    super(config);
    this.username = config.username;
    this.password = config.password;
    this.baseUrl = config.baseUrl || 'https://demo.campay.net/api';
    this._token = null;
    this._tokenExpiresAt = 0; // unix ms
  }

  /**
   * @private
   * Strip the '+' prefix from an E.164 Cameroon number.
   * Throws .statusCode=400 if the number is not a Cameroon number.
   */
  _normalizePhone(phone) {
    if (detectOperatorFromPhone(phone) === null) {
      const err = new Error(`Unsupported phone for Campay: ${phone}`);
      err.statusCode = 400;
      throw err;
    }
    return phone.replace(/^\+/, '');
  }

  async charge(_phone, _amount, _paymentRef) {
    throw new Error('CampayService.charge() not yet implemented');
  }

  async disburse(_phone, _amount, _paymentRef) {
    throw new Error('CampayService.disburse() not yet implemented');
  }

  async getStatus(_externalRef) {
    throw new Error('CampayService.getStatus() not yet implemented');
  }

  async refund(_externalRef) {
    throw new Error('Campay does not support native refunds');
  }
}

module.exports = CampayService;
```

- [ ] **Step 4: Wire Campay into the factory**

Edit `backend/src/services/payment/index.js`. Add the import and config block:

```js
'use strict';

const MTNMoMoService = require('./MTNMoMoService');
const OrangeMoneyService = require('./OrangeMoneyService');
const CampayService = require('./CampayService');

const config = {
  mtn: {
    apiUser: process.env.MTN_MOMO_API_USER,
    apiKey: process.env.MTN_MOMO_API_KEY,
    subscriptionKey: process.env.MTN_MOMO_SUBSCRIPTION_KEY,
    targetEnv: process.env.MTN_MOMO_TARGET_ENV || 'sandbox',
    callbackUrl: process.env.MTN_MOMO_CALLBACK_URL,
  },
  orange: {
    apiKey: process.env.ORANGE_MONEY_API_KEY,
    baseUrl: process.env.ORANGE_MONEY_BASE_URL,
  },
  campay: {
    username: process.env.CAMPAY_APP_USERNAME,
    password: process.env.CAMPAY_APP_PASSWORD,
    baseUrl: process.env.CAMPAY_BASE_URL || 'https://demo.campay.net/api',
  },
};

/**
 * Factory — get the correct PaymentProvider instance for a given gateway.
 * @param {'mtn_momo'|'orange_money'|'campay'} gateway
 * @returns {PaymentProvider}
 */
const getProvider = (gateway) => {
  switch (gateway) {
    case 'mtn_momo':     return new MTNMoMoService(config.mtn);
    case 'orange_money': return new OrangeMoneyService(config.orange);
    case 'campay': {
      if (!config.campay.username || !config.campay.password) {
        throw new Error('CAMPAY_APP_USERNAME and CAMPAY_APP_PASSWORD must be configured');
      }
      return new CampayService(config.campay);
    }
    default: throw new Error(`Unknown payment gateway: ${gateway}`);
  }
};

module.exports = { getProvider };
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx jest tests/unit/payment.service.test.js
```

Expected: PASS for all CampayService scaffold tests and factory tests. The existing MTN/Orange tests continue to pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/payment/CampayService.js \
        backend/src/services/payment/index.js \
        backend/tests/unit/payment.service.test.js
git commit -m "feat(payments): scaffold CampayService and add to factory"
```

---

## Task 5: CampayService._getToken with token caching

**Files:**
- Modify: `backend/src/services/payment/CampayService.js`
- Modify: `backend/tests/unit/payment.service.test.js`

- [ ] **Step 1: Write the failing tests**

Append to the `describe('CampayService', ...)` block in `payment.service.test.js`:

```js
  describe('_getToken token caching', () => {
    let service;
    let fetchSpy;

    beforeEach(() => {
      service = new CampayService({
        username: 'u', password: 'p', baseUrl: 'https://demo.campay.net/api',
      });
      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ token: 'tok-abc', expires_in: 3600 }),
      });
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('fetches a token on first call', async () => {
      const tok = await service._getToken();
      expect(tok).toBe('tok-abc');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://demo.campay.net/api/token/',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'u', password: 'p' }),
        })
      );
    });

    it('reuses the cached token on subsequent calls within expiry', async () => {
      await service._getToken();
      await service._getToken();
      await service._getToken();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('refetches when the cached token is within 5 minutes of expiry', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-23T12:00:00Z'));
      await service._getToken();
      // Advance 55 minutes — still in the "5 min before expiry" refresh window.
      jest.setSystemTime(new Date('2026-05-23T12:55:01Z'));
      await service._getToken();
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });

    it('throws .statusCode=502 when /token/ returns an error response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false, status: 401, text: async () => 'invalid credentials',
      });
      await expect(service._getToken()).rejects.toThrow(expect.objectContaining({
        statusCode: 502,
        message: expect.stringContaining('Campay token request failed'),
      }));
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/payment.service.test.js -t "_getToken"
```

Expected: FAIL (current `_getToken` doesn't exist; methods throw).

- [ ] **Step 3: Implement `_getToken`**

In `backend/src/services/payment/CampayService.js`, add the method below `_normalizePhone`:

```js
  /**
   * @private
   * Get a Campay JWT, using in-memory cache when the cached token is still fresh.
   * Refreshes 5 min before stated expiry to absorb clock skew + network latency.
   */
  async _getToken() {
    const now = Date.now();
    if (this._token && now < this._tokenExpiresAt - 5 * 60_000) {
      return this._token;
    }

    const res = await fetch(`${this.baseUrl}/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.username, password: this.password }),
    });

    if (!res.ok) {
      const body = await res.text();
      const err = new Error(`Campay token request failed (${res.status}): ${body}`);
      err.statusCode = 502;
      throw err;
    }

    const data = await res.json();
    this._token = data.token;
    this._tokenExpiresAt = now + (data.expires_in * 1000);
    return this._token;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/unit/payment.service.test.js -t "_getToken"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/payment/CampayService.js backend/tests/unit/payment.service.test.js
git commit -m "feat(payments): add CampayService._getToken with TTL-aware caching"
```

---

## Task 6: CampayService.charge — /collect/ + polling

**Files:**
- Modify: `backend/src/services/payment/CampayService.js`
- Modify: `backend/tests/unit/payment.service.test.js`

- [ ] **Step 1: Write the failing tests**

Append to the `describe('CampayService', ...)` block:

```js
  describe('charge', () => {
    let service;
    let fetchSpy;

    beforeEach(() => {
      service = new CampayService({
        username: 'u', password: 'p', baseUrl: 'https://demo.campay.net/api',
      });
      fetchSpy = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
      fetchSpy.mockRestore();
      jest.useRealTimers();
    });

    function mockToken() {
      fetchSpy.mockResolvedValueOnce({
        ok: true, json: async () => ({ token: 'tok', expires_in: 3600 }),
      });
    }
    function mockCollect(reference = 'campay-ref-1') {
      fetchSpy.mockResolvedValueOnce({
        ok: true, json: async () => ({ reference, ussd_code: '*126#', operator: 'mtn' }),
      });
    }
    function mockStatus(status, extras = {}) {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reference: 'campay-ref-1', status, ...extras }),
      });
    }

    it('happy path: charge resolves to SUCCESSFUL', async () => {
      mockToken();
      mockCollect('campay-ref-1');
      mockStatus('SUCCESSFUL', { operator: 'MTN', operator_reference: '00X' });

      const result = await service.charge('+237677000001', 5000, 'contrib-uuid-1');

      expect(result).toEqual(expect.objectContaining({
        success: true,
        externalRef: 'campay-ref-1',
        status: 'SUCCESSFUL',
      }));

      // Assert the /collect/ payload
      const collectCall = fetchSpy.mock.calls[1];
      expect(collectCall[0]).toBe('https://demo.campay.net/api/collect/');
      const body = JSON.parse(collectCall[1].body);
      expect(body).toEqual({
        amount: '5000',
        currency: 'XAF',
        from: '237677000001',
        description: expect.any(String),
        external_reference: 'contrib-uuid-1',
      });
      expect(collectCall[1].headers.Authorization).toBe('Token tok');
    });

    it('failed status maps to FAILED, success=false, no throw', async () => {
      mockToken();
      mockCollect();
      mockStatus('FAILED', { reason: 'Insufficient funds' });

      const result = await service.charge('+237677000001', 100, 'contrib-uuid-2');
      expect(result).toEqual(expect.objectContaining({
        success: false, status: 'FAILED',
      }));
    });

    it('TIMEOUT when polling never resolves within 30s', async () => {
      jest.useFakeTimers();
      mockToken();
      mockCollect();
      // All subsequent /transaction/ calls return PENDING forever.
      fetchSpy.mockResolvedValue({
        ok: true, json: async () => ({ reference: 'campay-ref-1', status: 'PENDING' }),
      });

      const promise = service.charge('+237677000001', 5000, 'contrib-uuid-3');
      // Advance through the polling window (2s interval x ~15 polls = 30s).
      await jest.advanceTimersByTimeAsync(31_000);

      const result = await promise;
      expect(result).toEqual(expect.objectContaining({
        success: false, status: 'TIMEOUT', externalRef: 'campay-ref-1',
      }));
    });

    it('throws .statusCode=502 when /collect/ returns 4xx', async () => {
      mockToken();
      fetchSpy.mockResolvedValueOnce({
        ok: false, status: 400, text: async () => '{"error":"bad amount"}',
      });
      await expect(service.charge('+237677000001', 0, 'contrib-uuid-4'))
        .rejects.toThrow(expect.objectContaining({ statusCode: 502 }));
    });

    it('throws .statusCode=400 (without calling fetch) for non-Cameroon phone', async () => {
      await expect(service.charge('+233241234567', 5000, 'contrib-uuid-5'))
        .rejects.toThrow(expect.objectContaining({ statusCode: 400 }));
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/payment.service.test.js -t "charge"
```

Expected: FAIL — current `charge` throws not-implemented.

- [ ] **Step 3: Implement `charge` and the supporting `_pollStatus`**

Replace the placeholder `charge()` in `backend/src/services/payment/CampayService.js` and add `_pollStatus`:

```js
  /**
   * @private
   * Poll GET /transaction/<reference>/ every 2 s, max 30 s. Returns the final
   * status string ('SUCCESSFUL' | 'FAILED' | 'TIMEOUT').
   */
  async _pollStatus(reference, token) {
    const POLL_INTERVAL_MS = 2_000;
    const POLL_TIMEOUT_MS = 30_000;
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const res = await fetch(`${this.baseUrl}/transaction/${reference}/`, {
        method: 'GET',
        headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status && data.status !== 'PENDING') {
          return data.status; // 'SUCCESSFUL' or 'FAILED'
        }
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
    return 'TIMEOUT';
  }

  /**
   * Debit a Cameroon mobile-money wallet.
   * @param {string} phone        — E.164, +237...
   * @param {number} amount       — integer XAF
   * @param {string} paymentRef   — caller's idempotent reference (e.g. contribution UUID)
   * @returns {Promise<{success: boolean, externalRef: string, status: string}>}
   */
  async charge(phone, amount, paymentRef) {
    const normalized = this._normalizePhone(phone);
    const token = await this._getToken();

    const collectRes = await fetch(`${this.baseUrl}/collect/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(amount),
        currency: 'XAF',
        from: normalized,
        description: 'NjangiBridge contribution',
        external_reference: paymentRef,
      }),
    });

    if (!collectRes.ok) {
      const body = await collectRes.text();
      const err = new Error(`Campay /collect/ failed (${collectRes.status}): ${body}`);
      err.statusCode = 502;
      throw err;
    }

    const { reference } = await collectRes.json();
    const status = await this._pollStatus(reference, token);

    return {
      success: status === 'SUCCESSFUL',
      externalRef: reference,
      status, // 'SUCCESSFUL' | 'FAILED' | 'TIMEOUT'
    };
  }
```

- [ ] **Step 4: Run the charge tests**

```bash
npx jest tests/unit/payment.service.test.js -t "charge"
```

Expected: PASS for all five cases.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/payment/CampayService.js backend/tests/unit/payment.service.test.js
git commit -m "feat(payments): implement CampayService.charge with /collect/ and polling"
```

---

## Task 7: CampayService.disburse — /withdraw/

**Files:**
- Modify: `backend/src/services/payment/CampayService.js`
- Modify: `backend/tests/unit/payment.service.test.js`

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('CampayService', ...)` block:

```js
  describe('disburse', () => {
    let service;
    let fetchSpy;

    beforeEach(() => {
      service = new CampayService({
        username: 'u', password: 'p', baseUrl: 'https://demo.campay.net/api',
      });
      fetchSpy = jest.spyOn(global, 'fetch');
    });
    afterEach(() => { fetchSpy.mockRestore(); });

    it('happy path: disburse resolves to SUCCESSFUL via /withdraw/', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true, json: async () => ({ token: 'tok', expires_in: 3600 }),
      });
      fetchSpy.mockResolvedValueOnce({
        ok: true, json: async () => ({ reference: 'wd-ref-1', status: 'PENDING' }),
      });
      fetchSpy.mockResolvedValueOnce({
        ok: true, json: async () => ({ reference: 'wd-ref-1', status: 'SUCCESSFUL' }),
      });

      const result = await service.disburse('+237677000001', 2500, 'payout-uuid-1');
      expect(result).toEqual(expect.objectContaining({
        success: true, externalRef: 'wd-ref-1', status: 'SUCCESSFUL',
      }));

      // Assert the /withdraw/ payload uses `to`, not `from`.
      const withdrawCall = fetchSpy.mock.calls[1];
      expect(withdrawCall[0]).toBe('https://demo.campay.net/api/withdraw/');
      const body = JSON.parse(withdrawCall[1].body);
      expect(body).toEqual({
        amount: '2500',
        to: '237677000001',
        description: expect.any(String),
        external_reference: 'payout-uuid-1',
      });
    });

    it('throws .statusCode=502 when /withdraw/ returns 4xx', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true, json: async () => ({ token: 'tok', expires_in: 3600 }),
      });
      fetchSpy.mockResolvedValueOnce({
        ok: false, status: 403,
        text: async () => '{"error":"withdrawals not enabled"}',
      });
      await expect(service.disburse('+237677000001', 100, 'payout-uuid-2'))
        .rejects.toThrow(expect.objectContaining({ statusCode: 502 }));
    });

    it('throws .statusCode=400 (without calling fetch) for non-Cameroon phone', async () => {
      await expect(service.disburse('+233241234567', 100, 'payout-uuid-3'))
        .rejects.toThrow(expect.objectContaining({ statusCode: 400 }));
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/payment.service.test.js -t "disburse"
```

Expected: FAIL — disburse still throws not-implemented.

- [ ] **Step 3: Implement `disburse`**

Replace the placeholder `disburse()` in `CampayService.js`:

```js
  /**
   * Credit a mobile-money wallet (withdrawal / payout).
   * Requires "Withdrawals through the API" to be enabled in the Campay dashboard.
   *
   * @param {string} phone        — E.164, +237...
   * @param {number} amount       — integer XAF
   * @param {string} paymentRef   — caller's idempotent reference (e.g. payout UUID)
   * @returns {Promise<{success: boolean, externalRef: string, status: string}>}
   */
  async disburse(phone, amount, paymentRef) {
    const normalized = this._normalizePhone(phone);
    const token = await this._getToken();

    const res = await fetch(`${this.baseUrl}/withdraw/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(amount),
        to: normalized,
        description: 'NjangiBridge payout',
        external_reference: paymentRef,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      const err = new Error(`Campay /withdraw/ failed (${res.status}): ${body}`);
      err.statusCode = 502;
      throw err;
    }

    const { reference } = await res.json();
    const status = await this._pollStatus(reference, token);
    return {
      success: status === 'SUCCESSFUL',
      externalRef: reference,
      status,
    };
  }
```

- [ ] **Step 4: Run tests**

```bash
npx jest tests/unit/payment.service.test.js -t "disburse"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/payment/CampayService.js backend/tests/unit/payment.service.test.js
git commit -m "feat(payments): implement CampayService.disburse via /withdraw/"
```

---

## Task 8: CampayService.getStatus

**Files:**
- Modify: `backend/src/services/payment/CampayService.js`
- Modify: `backend/tests/unit/payment.service.test.js`

- [ ] **Step 1: Write the failing test**

Append inside the `describe('CampayService', ...)` block:

```js
  describe('getStatus', () => {
    let service;
    let fetchSpy;

    beforeEach(() => {
      service = new CampayService({ username: 'u', password: 'p' });
      fetchSpy = jest.spyOn(global, 'fetch');
    });
    afterEach(() => { fetchSpy.mockRestore(); });

    it('returns the status from a single /transaction/<ref>/ call', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true, json: async () => ({ token: 'tok', expires_in: 3600 }),
      });
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reference: 'r-1', status: 'SUCCESSFUL', amount: 5 }),
      });

      const status = await service.getStatus('r-1');
      expect(status).toBe('SUCCESSFUL');
      expect(fetchSpy.mock.calls[1][0]).toBe('https://demo.campay.net/api/transaction/r-1/');
    });

    it('throws .statusCode=502 on upstream error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true, json: async () => ({ token: 'tok', expires_in: 3600 }),
      });
      fetchSpy.mockResolvedValueOnce({
        ok: false, status: 404, text: async () => 'not found',
      });
      await expect(service.getStatus('r-1'))
        .rejects.toThrow(expect.objectContaining({ statusCode: 502 }));
    });
  });
```

- [ ] **Step 2: Run tests to verify failure**

```bash
npx jest tests/unit/payment.service.test.js -t "getStatus"
```

Expected: FAIL.

- [ ] **Step 3: Implement `getStatus`**

Replace the placeholder `getStatus()`:

```js
  /**
   * Look up the current status of a Campay transaction.
   * @param {string} externalRef — the reference returned by charge/disburse
   * @returns {Promise<string>}  'SUCCESSFUL' | 'FAILED' | 'PENDING'
   */
  async getStatus(externalRef) {
    const token = await this._getToken();
    const res = await fetch(`${this.baseUrl}/transaction/${externalRef}/`, {
      method: 'GET',
      headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const body = await res.text();
      const err = new Error(`Campay /transaction/ failed (${res.status}): ${body}`);
      err.statusCode = 502;
      throw err;
    }
    const data = await res.json();
    return data.status;
  }
```

- [ ] **Step 4: Run tests**

```bash
npx jest tests/unit/payment.service.test.js
```

Expected: PASS — all Campay tests green; existing MTN/Orange tests still green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/payment/CampayService.js backend/tests/unit/payment.service.test.js
git commit -m "feat(payments): implement CampayService.getStatus"
```

---

## Task 9: Database migration — preferred_gateway + preferred_payout_gateway

**Files:**
- Create: `backend/src/config/migrations/2026-05-23-add-preferred-gateway.sql`
- Modify: `backend/src/config/schema.sql` (append the same `ALTER TABLE` statements at the bottom, or insert into the existing `njangi_groups` definition — whichever matches the project's convention)

- [ ] **Step 1: Create the migration file**

Create `backend/src/config/migrations/2026-05-23-add-preferred-gateway.sql`:

```sql
-- Migration: 2026-05-23 — add per-group payment gateway columns
-- Spec: docs/superpowers/specs/2026-05-23-campay-gateway-design.md (commit 6ed3a7d)

-- Collection rail. NOT NULL with a safe default so every existing group
-- keeps behaving identically until an admin opts them in.
ALTER TABLE njangi_groups
  ADD COLUMN preferred_gateway text NOT NULL DEFAULT 'mtn_momo'
    CHECK (preferred_gateway IN ('mtn_momo', 'orange_money', 'campay'));

-- Payout rail. NULLABLE — NULL means "fall back to phone-prefix routing"
-- (the existing behavior). Setting it to 'campay' opts the group into
-- Campay disbursement; 'mtn_momo' / 'orange_money' force a specific
-- direct API (only sensible for single-operator groups).
ALTER TABLE njangi_groups
  ADD COLUMN preferred_payout_gateway text NULL
    CHECK (preferred_payout_gateway IS NULL
           OR preferred_payout_gateway IN ('mtn_momo', 'orange_money', 'campay'));
```

- [ ] **Step 2: Update `schema.sql`**

Read `backend/src/config/schema.sql`. Find the `CREATE TABLE njangi_groups` block. Inside the column list, just before the closing `);`, add:

```sql
  preferred_gateway        text NOT NULL DEFAULT 'mtn_momo'
                           CHECK (preferred_gateway IN ('mtn_momo','orange_money','campay')),
  preferred_payout_gateway text NULL
                           CHECK (preferred_payout_gateway IS NULL
                                  OR preferred_payout_gateway IN ('mtn_momo','orange_money','campay')),
```

(Place the comma correctly relative to the existing last column.)

- [ ] **Step 3: Apply the migration to the dev/test Supabase project**

This is a manual step — the project has no migration runner per the spec. The implementer runs the SQL against the dev Supabase via the Supabase SQL editor OR `psql` connected to the dev database.

Confirm with:

```sql
SELECT column_name, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_name = 'njangi_groups'
   AND column_name IN ('preferred_gateway', 'preferred_payout_gateway');
```

Expected: two rows, `preferred_gateway` NOT NULL DEFAULT `'mtn_momo'`, `preferred_payout_gateway` NULLABLE no default.

- [ ] **Step 4: Run the unit test suite to confirm nothing broke**

```bash
npx jest tests/unit
```

Expected: PASS (no behavioral change — the unit tests don't talk to the live DB).

- [ ] **Step 5: Commit**

```bash
git add backend/src/config/migrations/2026-05-23-add-preferred-gateway.sql backend/src/config/schema.sql
git commit -m "chore(db): add preferred_gateway and preferred_payout_gateway to njangi_groups"
```

---

## Task 10: group.service.updateGateway

**Files:**
- Modify: `backend/src/modules/groups/group.service.js`
- Modify: `backend/tests/unit/group.service.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/unit/group.service.test.js`:

```js
const groupService = require('../../src/modules/groups/group.service');

// The module imports supabase directly; replace it on the module's exports for tests.
// Inspect the file: it does `const { supabase } = require('../../config/supabase');`
// We use jest.mock to substitute. Place this jest.mock at the top of the test file
// if not already present:
jest.mock('../../src/config/supabase', () => {
  const chain = {
    from: jest.fn(() => chain),
    update: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    select: jest.fn(() => chain),
    single: jest.fn(),
  };
  return { supabase: chain };
});
const { supabase: mockedSupabase } = require('../../src/config/supabase');

describe('group.service.updateGateway', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-prime the chain (clearAllMocks wipes implementations).
    mockedSupabase.from.mockReturnValue(mockedSupabase);
    mockedSupabase.update.mockReturnValue(mockedSupabase);
    mockedSupabase.eq.mockReturnValue(mockedSupabase);
    mockedSupabase.select.mockReturnValue(mockedSupabase);
  });

  it('updates preferred_gateway on njangi_groups and returns the row', async () => {
    mockedSupabase.single.mockResolvedValueOnce({
      data: { id: 'g1', preferred_gateway: 'campay' }, error: null,
    });

    const result = await groupService.updateGateway('g1', 'campay');

    expect(mockedSupabase.from).toHaveBeenCalledWith('njangi_groups');
    expect(mockedSupabase.update).toHaveBeenCalledWith({ preferred_gateway: 'campay' });
    expect(mockedSupabase.eq).toHaveBeenCalledWith('id', 'g1');
    expect(result).toEqual({ id: 'g1', preferred_gateway: 'campay' });
  });

  it('throws .statusCode=400 for an invalid gateway value without hitting DB', async () => {
    await expect(groupService.updateGateway('g1', 'bogus'))
      .rejects.toThrow(expect.objectContaining({ statusCode: 400, message: /invalid gateway/i }));
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });

  it('throws .statusCode=404 when the group is not found', async () => {
    mockedSupabase.single.mockResolvedValueOnce({ data: null, error: null });
    await expect(groupService.updateGateway('missing', 'mtn_momo'))
      .rejects.toThrow(expect.objectContaining({ statusCode: 404 }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/group.service.test.js -t "updateGateway"
```

Expected: FAIL — `groupService.updateGateway` does not exist.

- [ ] **Step 3: Implement `updateGateway`**

In `backend/src/modules/groups/group.service.js`, append a new method on the exported object (or class, matching the file's style). Add this above `module.exports`:

```js
async function updateGateway(groupId, gateway) {
  if (!['mtn_momo', 'orange_money', 'campay'].includes(gateway)) {
    const e = new Error('invalid gateway');
    e.statusCode = 400;
    e.code = 'VALIDATION_ERROR';
    throw e;
  }

  const { data, error } = await supabase
    .from('njangi_groups')
    .update({ preferred_gateway: gateway })
    .eq('id', groupId)
    .select()
    .single();

  if (error) {
    const e = new Error('failed to update gateway');
    e.statusCode = 500;
    e.code = 'DB_ERROR';
    throw e;
  }
  if (!data) {
    const e = new Error('group not found');
    e.statusCode = 404;
    e.code = 'GROUP_NOT_FOUND';
    throw e;
  }
  return data;
}
```

And add `updateGateway` to the `module.exports` block. (Match the existing export style — if the file exports a class or an object literal, append the method there.)

- [ ] **Step 4: Run tests**

```bash
npx jest tests/unit/group.service.test.js -t "updateGateway"
```

Expected: PASS for all three cases.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/groups/group.service.js backend/tests/unit/group.service.test.js
git commit -m "feat(groups): add group.service.updateGateway"
```

---

## Task 11: group.service.updatePayoutGateway

**Files:**
- Modify: `backend/src/modules/groups/group.service.js`
- Modify: `backend/tests/unit/group.service.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `group.service.test.js`:

```js
describe('group.service.updatePayoutGateway', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSupabase.from.mockReturnValue(mockedSupabase);
    mockedSupabase.update.mockReturnValue(mockedSupabase);
    mockedSupabase.eq.mockReturnValue(mockedSupabase);
    mockedSupabase.select.mockReturnValue(mockedSupabase);
  });

  it.each(['mtn_momo', 'orange_money', 'campay'])(
    'accepts %s and updates the column', async (value) => {
      mockedSupabase.single.mockResolvedValueOnce({
        data: { id: 'g1', preferred_payout_gateway: value }, error: null,
      });
      const result = await groupService.updatePayoutGateway('g1', value);
      expect(mockedSupabase.update).toHaveBeenCalledWith({ preferred_payout_gateway: value });
      expect(result.preferred_payout_gateway).toBe(value);
    }
  );

  it('accepts null to clear the column (revert to phone-prefix routing)', async () => {
    mockedSupabase.single.mockResolvedValueOnce({
      data: { id: 'g1', preferred_payout_gateway: null }, error: null,
    });
    const result = await groupService.updatePayoutGateway('g1', null);
    expect(mockedSupabase.update).toHaveBeenCalledWith({ preferred_payout_gateway: null });
    expect(result.preferred_payout_gateway).toBeNull();
  });

  it('throws .statusCode=400 for invalid value without hitting DB', async () => {
    await expect(groupService.updatePayoutGateway('g1', 'bogus'))
      .rejects.toThrow(expect.objectContaining({ statusCode: 400 }));
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });

  it('throws .statusCode=404 when the group is not found', async () => {
    mockedSupabase.single.mockResolvedValueOnce({ data: null, error: null });
    await expect(groupService.updatePayoutGateway('missing', 'campay'))
      .rejects.toThrow(expect.objectContaining({ statusCode: 404 }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/group.service.test.js -t "updatePayoutGateway"
```

Expected: FAIL.

- [ ] **Step 3: Implement `updatePayoutGateway`**

Add to `backend/src/modules/groups/group.service.js`:

```js
async function updatePayoutGateway(groupId, payoutGateway) {
  if (payoutGateway !== null &&
      !['mtn_momo', 'orange_money', 'campay'].includes(payoutGateway)) {
    const e = new Error('invalid payout gateway');
    e.statusCode = 400;
    e.code = 'VALIDATION_ERROR';
    throw e;
  }

  const { data, error } = await supabase
    .from('njangi_groups')
    .update({ preferred_payout_gateway: payoutGateway })
    .eq('id', groupId)
    .select()
    .single();

  if (error) {
    const e = new Error('failed to update payout gateway');
    e.statusCode = 500;
    e.code = 'DB_ERROR';
    throw e;
  }
  if (!data) {
    const e = new Error('group not found');
    e.statusCode = 404;
    e.code = 'GROUP_NOT_FOUND';
    throw e;
  }
  return data;
}
```

Add `updatePayoutGateway` to the file's exports.

- [ ] **Step 4: Run tests**

```bash
npx jest tests/unit/group.service.test.js -t "updatePayoutGateway"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/groups/group.service.js backend/tests/unit/group.service.test.js
git commit -m "feat(groups): add group.service.updatePayoutGateway"
```

---

## Task 12: PATCH /groups/:groupId/gateway endpoint

**Files:**
- Modify: `backend/src/modules/groups/group.validation.js`
- Modify: `backend/src/modules/groups/group.controller.js`
- Modify: `backend/src/modules/groups/group.routes.js`
- Modify: `backend/tests/integration/group.api.test.js`

- [ ] **Step 1: Write the failing integration tests**

Append to `backend/tests/integration/group.api.test.js`. (Follow the file's existing pattern for test-DB setup and JWT factory — re-use whatever helpers are already there for creating a group + president JWT.)

```js
describe('PATCH /groups/:groupId/gateway', () => {
  let groupId;
  let presidentToken;
  let memberToken;

  beforeAll(async () => {
    // Use the same setup helpers the existing tests use to seed a group + JWTs.
    // The fixture below assumes helpers `createTestGroup` and `tokenForUser` exist
    // in this file. If not, adapt to whatever is already there.
    ({ groupId, presidentToken, memberToken } = await createTestGroupWithRoles());
  });

  it('president can change the collection gateway to campay', async () => {
    const res = await request(app)
      .patch(`/groups/${groupId}/gateway`)
      .set('Authorization', `Bearer ${presidentToken}`)
      .send({ gateway: 'campay' });

    expect(res.status).toBe(200);
    expect(res.body.preferred_gateway).toBe('campay');
  });

  it('non-president receives 403', async () => {
    const res = await request(app)
      .patch(`/groups/${groupId}/gateway`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ gateway: 'campay' });
    expect(res.status).toBe(403);
  });

  it('invalid gateway value returns 400', async () => {
    const res = await request(app)
      .patch(`/groups/${groupId}/gateway`)
      .set('Authorization', `Bearer ${presidentToken}`)
      .send({ gateway: 'bogus' });
    expect(res.status).toBe(400);
  });

  it('non-existent group returns 404', async () => {
    const res = await request(app)
      .patch('/groups/00000000-0000-0000-0000-000000000000/gateway')
      .set('Authorization', `Bearer ${presidentToken}`)
      .send({ gateway: 'mtn_momo' });
    expect(res.status).toBe(404);
  });
});
```

(These are skip-guarded — only run when `backend/.env.test` is present. Follow the existing skip-guard pattern in the file.)

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/integration/group.api.test.js -t "PATCH /groups/:groupId/gateway"
```

Expected: FAIL — route does not exist. (If `.env.test` is missing, the test will be skipped — that's OK; we still test the unit pieces below.)

- [ ] **Step 3: Add the Joi validation schema**

Edit `backend/src/modules/groups/group.validation.js`. Append:

```js
const updateGatewaySchema = Joi.object({
  gateway: Joi.string().valid('mtn_momo', 'orange_money', 'campay').required(),
});

module.exports = { createGroupSchema, updateGroupSchema, updateGatewaySchema };
```

(Replace the existing single-line `module.exports` accordingly.)

- [ ] **Step 4: Add the controller**

Edit `backend/src/modules/groups/group.controller.js`. Import the schema and the AuditService, then add a controller:

```js
const { AuditService, AuditEvents } = require('../../services/audit/AuditService');
const { supabase } = require('../../config/supabase');
const audit = new AuditService(supabase);
const { createGroupSchema, updateGroupSchema, updateGatewaySchema } = require('./group.validation');

const updateGateway = async (req, res, next) => {
  try {
    const { error, value } = updateGatewaySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message, code: 'VALIDATION_ERROR' });

    // Fetch the current value first so the audit log can record the transition.
    const { data: before } = await supabase
      .from('njangi_groups')
      .select('preferred_gateway')
      .eq('id', req.params.groupId)
      .maybeSingle();
    const oldGateway = before ? before.preferred_gateway : null;

    const group = await groupService.updateGateway(req.params.groupId, value.gateway);

    await audit.log(req.params.groupId, req.user.sub, AuditEvents.GATEWAY_CHANGED, {
      from: oldGateway, to: value.gateway,
    });
    return res.status(200).json(group);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

module.exports = { createGroup, getGroup, updateSettings, updateGateway };
```

- [ ] **Step 5: Add the route + Swagger annotation**

Edit `backend/src/modules/groups/group.routes.js`. After the existing PATCH on line 102, add:

```js
/**
 * @swagger
 * /groups/{groupId}/gateway:
 *   patch:
 *     summary: Change the group's preferred collection gateway (President only)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gateway]
 *             properties:
 *               gateway:
 *                 type: string
 *                 enum: [mtn_momo, orange_money, campay]
 *                 example: campay
 *     responses:
 *       200: { description: Gateway updated }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       403: { description: Not a group president }
 *       404: { description: Group not found }
 *       500: { description: Server error }
 */
router.patch('/:groupId/gateway', auth, tenant, requireRole('president'), updateGateway);
```

Also import `updateGateway` in the file's top imports:

```js
const { createGroup, getGroup, updateSettings, updateGateway } = require('./group.controller');
```

- [ ] **Step 6: Run all tests**

```bash
npx jest tests/unit/group.service.test.js
npx jest tests/integration/group.api.test.js -t "PATCH /groups/:groupId/gateway"
```

Expected: Unit tests PASS. Integration tests PASS (if `.env.test` is configured) or skip cleanly.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/groups/group.validation.js \
        backend/src/modules/groups/group.controller.js \
        backend/src/modules/groups/group.routes.js \
        backend/tests/integration/group.api.test.js
git commit -m "feat(groups): add PATCH /groups/:groupId/gateway endpoint"
```

---

## Task 13: PATCH /groups/:groupId/payout-gateway endpoint

**Files:**
- Modify: `backend/src/modules/groups/group.validation.js`
- Modify: `backend/src/modules/groups/group.controller.js`
- Modify: `backend/src/modules/groups/group.routes.js`
- Modify: `backend/tests/integration/group.api.test.js`

- [ ] **Step 1: Write the failing integration tests**

Append to `group.api.test.js`:

```js
describe('PATCH /groups/:groupId/payout-gateway', () => {
  let groupId; let presidentToken; let memberToken;
  beforeAll(async () => {
    ({ groupId, presidentToken, memberToken } = await createTestGroupWithRoles());
  });

  it('president can set payout_gateway to campay', async () => {
    const res = await request(app)
      .patch(`/groups/${groupId}/payout-gateway`)
      .set('Authorization', `Bearer ${presidentToken}`)
      .send({ payout_gateway: 'campay' });
    expect(res.status).toBe(200);
    expect(res.body.preferred_payout_gateway).toBe('campay');
  });

  it('president can clear payout_gateway with null', async () => {
    const res = await request(app)
      .patch(`/groups/${groupId}/payout-gateway`)
      .set('Authorization', `Bearer ${presidentToken}`)
      .send({ payout_gateway: null });
    expect(res.status).toBe(200);
    expect(res.body.preferred_payout_gateway).toBeNull();
  });

  it('non-president receives 403', async () => {
    const res = await request(app)
      .patch(`/groups/${groupId}/payout-gateway`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ payout_gateway: 'campay' });
    expect(res.status).toBe(403);
  });

  it('invalid payout_gateway value returns 400', async () => {
    const res = await request(app)
      .patch(`/groups/${groupId}/payout-gateway`)
      .set('Authorization', `Bearer ${presidentToken}`)
      .send({ payout_gateway: 'bogus' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/integration/group.api.test.js -t "PATCH /groups/:groupId/payout-gateway"
```

Expected: FAIL or skip.

- [ ] **Step 3: Add the validation schema**

Edit `backend/src/modules/groups/group.validation.js`. Append:

```js
const updatePayoutGatewaySchema = Joi.object({
  // null is valid and means "clear the column" (revert to phone-prefix routing).
  payout_gateway: Joi.string().valid('mtn_momo', 'orange_money', 'campay').allow(null).required(),
});

module.exports = {
  createGroupSchema,
  updateGroupSchema,
  updateGatewaySchema,
  updatePayoutGatewaySchema,
};
```

- [ ] **Step 4: Add the controller**

In `backend/src/modules/groups/group.controller.js`, import the schema and add the controller:

```js
const {
  createGroupSchema,
  updateGroupSchema,
  updateGatewaySchema,
  updatePayoutGatewaySchema,
} = require('./group.validation');

const updatePayoutGateway = async (req, res, next) => {
  try {
    const { error, value } = updatePayoutGatewaySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message, code: 'VALIDATION_ERROR' });

    const { data: before } = await supabase
      .from('njangi_groups')
      .select('preferred_payout_gateway')
      .eq('id', req.params.groupId)
      .maybeSingle();
    const oldPayoutGateway = before ? before.preferred_payout_gateway : null;

    const group = await groupService.updatePayoutGateway(req.params.groupId, value.payout_gateway);

    await audit.log(req.params.groupId, req.user.sub, AuditEvents.PAYOUT_GATEWAY_CHANGED, {
      from: oldPayoutGateway, to: value.payout_gateway,
    });
    return res.status(200).json(group);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
    next(err);
  }
};

module.exports = {
  createGroup, getGroup, updateSettings, updateGateway, updatePayoutGateway,
};
```

- [ ] **Step 5: Add the route + Swagger**

In `backend/src/modules/groups/group.routes.js`:

```js
const {
  createGroup, getGroup, updateSettings, updateGateway, updatePayoutGateway,
} = require('./group.controller');

/**
 * @swagger
 * /groups/{groupId}/payout-gateway:
 *   patch:
 *     summary: Change the group's preferred payout gateway (President only)
 *     description: |
 *       Setting payout_gateway to null reverts the group to phone-prefix
 *       routing (the default). Setting it to 'campay' routes payouts via
 *       Campay's /withdraw/ endpoint.
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [payout_gateway]
 *             properties:
 *               payout_gateway:
 *                 type: [string, "null"]
 *                 enum: [mtn_momo, orange_money, campay, null]
 *                 example: campay
 *     responses:
 *       200: { description: Payout gateway updated }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       403: { description: Not a group president }
 *       404: { description: Group not found }
 *       500: { description: Server error }
 */
router.patch('/:groupId/payout-gateway', auth, tenant, requireRole('president'), updatePayoutGateway);
```

- [ ] **Step 6: Run all tests**

```bash
npx jest tests/unit/group.service.test.js
npx jest tests/integration/group.api.test.js -t "PATCH /groups/:groupId/payout-gateway"
```

Expected: PASS (or skip on integration if `.env.test` absent).

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/groups/group.validation.js \
        backend/src/modules/groups/group.controller.js \
        backend/src/modules/groups/group.routes.js \
        backend/tests/integration/group.api.test.js
git commit -m "feat(groups): add PATCH /groups/:groupId/payout-gateway endpoint"
```

---

## Task 14: paymentsService.applyTerminalStatus

**Files:**
- Create: `backend/src/modules/payments/payments.service.js`
- Create: `backend/tests/unit/payments.service.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/payments.service.test.js`:

```js
'use strict';

jest.mock('../../src/config/supabase', () => {
  const chain = {
    from: jest.fn(() => chain),
    select: jest.fn(() => chain),
    update: jest.fn(() => chain),
    insert: jest.fn().mockResolvedValue({ error: null }),
    eq: jest.fn(() => chain),
    maybeSingle: jest.fn(),
  };
  return { supabase: chain };
});
const { supabase } = require('../../src/config/supabase');

const { applyTerminalStatus } = require('../../src/modules/payments/payments.service');

function resetChain() {
  jest.clearAllMocks();
  supabase.from.mockReturnValue(supabase);
  supabase.select.mockReturnValue(supabase);
  supabase.update.mockReturnValue(supabase);
  supabase.insert.mockResolvedValue({ error: null });
  supabase.eq.mockReturnValue(supabase);
}

describe('payments.service.applyTerminalStatus', () => {
  beforeEach(resetChain);

  describe('endpoint: collect (contributions table)', () => {
    it('updates a PENDING contribution to SUCCESSFUL and writes audit log', async () => {
      supabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 'contrib-1', status: 'PENDING', group_id: 'g-1' }, error: null,
      });
      supabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 'contrib-1', status: 'SUCCESSFUL' }, error: null,
      });

      const result = await applyTerminalStatus({
        paymentRef: 'contrib-1', externalRef: 'campay-r-1',
        status: 'SUCCESSFUL', endpoint: 'collect',
        rawPayload: { foo: 'bar' },
      });

      expect(supabase.from).toHaveBeenCalledWith('contributions');
      expect(supabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'SUCCESSFUL',
          external_ref: 'campay-r-1',
          paid_at: expect.any(String),
        })
      );
      // Audit log written to audit_events
      expect(supabase.from).toHaveBeenCalledWith('audit_events');
      expect(supabase.insert).toHaveBeenCalledWith(expect.objectContaining({
        group_id: 'g-1',
        event_type: 'CONTRIBUTION_CONFIRMED',
      }));
      expect(result).toEqual({ updated: true });
    });

    it('writes CONTRIBUTION_FAILED audit event on FAILED status', async () => {
      supabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 'contrib-1f', status: 'PENDING', group_id: 'g-1' }, error: null,
      });
      supabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 'contrib-1f', status: 'FAILED' }, error: null,
      });
      await applyTerminalStatus({
        paymentRef: 'contrib-1f', externalRef: 'r', status: 'FAILED', endpoint: 'collect',
      });
      expect(supabase.insert).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'CONTRIBUTION_FAILED',
      }));
    });

    it('is a no-op when the contribution is already in a terminal status', async () => {
      supabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 'contrib-2', status: 'SUCCESSFUL' }, error: null,
      });

      const result = await applyTerminalStatus({
        paymentRef: 'contrib-2', externalRef: 'campay-r-2',
        status: 'SUCCESSFUL', endpoint: 'collect',
      });

      expect(supabase.update).not.toHaveBeenCalled();
      expect(result).toEqual({ updated: false, reason: 'already-terminal' });
    });

    it('returns { updated: false, reason: "not-found" } when contribution row is missing', async () => {
      supabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      const result = await applyTerminalStatus({
        paymentRef: 'unknown', externalRef: 'r', status: 'FAILED', endpoint: 'collect',
      });
      expect(result).toEqual({ updated: false, reason: 'not-found' });
      expect(supabase.update).not.toHaveBeenCalled();
    });
  });

  describe('endpoint: withdraw (payouts table)', () => {
    it('updates a PENDING payout to SUCCESSFUL and writes PAYOUT_EXECUTED audit', async () => {
      supabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 'payout-1', status: 'PENDING', group_id: 'g-1' }, error: null,
      });
      supabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 'payout-1', status: 'SUCCESSFUL' }, error: null,
      });
      const result = await applyTerminalStatus({
        paymentRef: 'payout-1', externalRef: 'campay-wd-1',
        status: 'SUCCESSFUL', endpoint: 'withdraw',
      });
      expect(supabase.from).toHaveBeenCalledWith('payouts');
      expect(supabase.insert).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'PAYOUT_EXECUTED',
      }));
      expect(result).toEqual({ updated: true });
    });

    it('writes PAYOUT_FAILED audit event on FAILED status', async () => {
      supabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 'payout-1f', status: 'PENDING', group_id: 'g-1' }, error: null,
      });
      supabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 'payout-1f', status: 'FAILED' }, error: null,
      });
      await applyTerminalStatus({
        paymentRef: 'payout-1f', externalRef: 'r', status: 'FAILED', endpoint: 'withdraw',
      });
      expect(supabase.insert).toHaveBeenCalledWith(expect.objectContaining({
        event_type: 'PAYOUT_FAILED',
      }));
    });
  });

  it('throws when endpoint is neither collect nor withdraw', async () => {
    await expect(applyTerminalStatus({
      paymentRef: 'x', externalRef: 'y', status: 'SUCCESSFUL', endpoint: 'mystery',
    })).rejects.toThrow(/unknown endpoint/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/unit/payments.service.test.js
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `applyTerminalStatus`**

Create `backend/src/modules/payments/payments.service.js`:

```js
'use strict';

const { supabase } = require('../../config/supabase');
const { AuditService, AuditEvents } = require('../../services/audit/AuditService');

const audit = new AuditService(supabase);

const TERMINAL_STATUSES = new Set(['SUCCESSFUL', 'FAILED', 'CANCELLED']);

// (endpoint, success?) → AuditEvents type
const EVENT_MAP = {
  collect:  { success: AuditEvents.CONTRIBUTION_CONFIRMED, failure: AuditEvents.CONTRIBUTION_FAILED },
  withdraw: { success: AuditEvents.PAYOUT_EXECUTED,        failure: AuditEvents.PAYOUT_FAILED        },
};

/**
 * Idempotently apply a terminal payment status to either a contribution
 * (endpoint='collect') or a payout (endpoint='withdraw') row, then write
 * the matching audit event.
 *
 * Returns { updated: true } when the row transitioned to terminal,
 * { updated: false, reason: 'already-terminal' } when the row was already
 * in a terminal state, { updated: false, reason: 'not-found' } when no row
 * exists for the given paymentRef.
 *
 * @param {Object} args
 * @param {string} args.paymentRef     Our internal UUID (contribution.id or payout.id).
 * @param {string} args.externalRef    Campay's reference UUID.
 * @param {'SUCCESSFUL'|'FAILED'|'CANCELLED'} args.status
 * @param {'collect'|'withdraw'} args.endpoint
 * @param {Object} [args.rawPayload]   Optional full webhook payload (kept in audit payload).
 */
async function applyTerminalStatus({ paymentRef, externalRef, status, endpoint, rawPayload }) {
  const eventMap = EVENT_MAP[endpoint];
  if (!eventMap) {
    throw new Error(`applyTerminalStatus: unknown endpoint "${endpoint}"`);
  }
  const table = endpoint === 'collect' ? 'contributions' : 'payouts';
  const timestampField = status === 'SUCCESSFUL' ? 'paid_at' : 'failed_at';

  // Fetch the existing row (need group_id so audit log can be written against
  // the right group; need status so we can no-op when already terminal).
  const { data: existing } = await supabase
    .from(table)
    .select('id, status, group_id')
    .eq('id', paymentRef)
    .maybeSingle();

  if (!existing) {
    return { updated: false, reason: 'not-found' };
  }
  if (TERMINAL_STATUSES.has(existing.status)) {
    return { updated: false, reason: 'already-terminal' };
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from(table)
    .update({ status, external_ref: externalRef, [timestampField]: nowIso })
    .eq('id', paymentRef)
    .select()
    .maybeSingle();

  // Best-effort audit log. AuditService.log catches its own errors and
  // logs to console — never crashes the main flow.
  // userId is null because the webhook is a system-driven update with no
  // authenticated user context. If audit_events.user_id is NOT NULL, the
  // insert fails silently per AuditService's "never crash" contract.
  const eventType = status === 'SUCCESSFUL' ? eventMap.success : eventMap.failure;
  await audit.log(existing.group_id, null, eventType, {
    paymentRef,
    externalRef,
    status,
    endpoint,
    webhookPayload: rawPayload,
  });

  return { updated: true };
}

module.exports = { applyTerminalStatus };
```

- [ ] **Step 4: Run tests**

```bash
npx jest tests/unit/payments.service.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/payments/payments.service.js backend/tests/unit/payments.service.test.js
git commit -m "feat(payments): add idempotent applyTerminalStatus for webhook + polling"
```

---

## Task 15: Webhook controller + route + app.js mount

**Files:**
- Create: `backend/src/modules/payments/payments.controller.js`
- Create: `backend/src/modules/payments/payments.routes.js`
- Modify: `backend/src/app.js`
- Create: `backend/tests/integration/campay.webhook.integration.test.js`

- [ ] **Step 1: Write the failing integration test**

Create `backend/tests/integration/campay.webhook.integration.test.js`:

```js
'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');

const skipIfNoEnv = process.env.CAMPAY_WEBHOOK_KEY ? describe : describe.skip;

skipIfNoEnv('Campay webhook (POST /payments/campay/notify)', () => {
  const app = require('../../src/app');
  const KEY = process.env.CAMPAY_WEBHOOK_KEY;

  function makePayload({ status = 'SUCCESSFUL', extRef = 'contrib-test-1', endpoint = 'collect' } = {}) {
    const params = {
      status,
      reference: 'campay-test-ref-1',
      external_reference: extRef,
      amount: '5000',
      currency: 'XAF',
      operator: 'MTN',
      code: 'TEST-CODE',
      operator_reference: 'op-1',
      endpoint,
      phone_number: '237677000001',
    };
    params.signature = jwt.sign(params, KEY, { algorithm: 'HS256' });
    return params;
  }

  it('returns 200 on a valid POST webhook', async () => {
    const body = makePayload();
    const res = await request(app)
      .post('/payments/campay/notify')
      .send(body);
    expect(res.status).toBe(200);
  });

  it('returns 200 on a valid GET webhook', async () => {
    const body = makePayload();
    const res = await request(app)
      .get('/payments/campay/notify')
      .query(body);
    expect(res.status).toBe(200);
  });

  it('returns 401 when the signature is invalid', async () => {
    const body = makePayload();
    body.signature = jwt.sign(body, 'wrong-key', { algorithm: 'HS256' });
    const res = await request(app)
      .post('/payments/campay/notify')
      .send(body);
    expect(res.status).toBe(401);
  });

  it('returns 401 when the signature field is missing', async () => {
    const body = makePayload();
    delete body.signature;
    const res = await request(app)
      .post('/payments/campay/notify')
      .send(body);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (or skip)**

```bash
npx jest tests/integration/campay.webhook.integration.test.js
```

Expected: FAIL with 404 (route doesn't exist) OR skip when `CAMPAY_WEBHOOK_KEY` env is absent. (For local verification, set `export CAMPAY_WEBHOOK_KEY=any-test-value` in your shell, then re-run.)

- [ ] **Step 3: Create the controller**

Create `backend/src/modules/payments/payments.controller.js`:

```js
'use strict';

const { verifyWebhookSignature } = require('../../services/payment/campaySignature');
const { applyTerminalStatus } = require('./payments.service');

/**
 * Normalize Campay's status string to the internal vocabulary.
 * Campay sends 'SUCCESSFUL' | 'FAILED' | 'CANCELLED' (all uppercase per docs).
 */
function mapStatus(campayStatus) {
  if (campayStatus === 'SUCCESSFUL') return 'SUCCESSFUL';
  if (campayStatus === 'FAILED')     return 'FAILED';
  if (campayStatus === 'CANCELLED')  return 'CANCELLED';
  // Unknown — treat as FAILED so the ledger doesn't stay PENDING forever.
  return 'FAILED';
}

const handleCampayNotify = async (req, res) => {
  const params = (req.method === 'GET' || Object.keys(req.body || {}).length === 0)
    ? req.query
    : req.body;

  const signature = params && params.signature;
  if (!signature) {
    // eslint-disable-next-line no-console
    console.warn('[Campay webhook] rejected: missing signature');
    return res.status(401).json({ error: 'invalid signature' });
  }

  const decoded = verifyWebhookSignature(signature, process.env.CAMPAY_WEBHOOK_KEY);
  if (!decoded) {
    // eslint-disable-next-line no-console
    console.warn('[Campay webhook] rejected: invalid signature');
    return res.status(401).json({ error: 'invalid signature' });
  }

  try {
    const result = await applyTerminalStatus({
      paymentRef:  params.external_reference,
      externalRef: params.reference,
      status:      mapStatus(params.status),
      endpoint:    params.endpoint,
      rawPayload:  params,
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Campay webhook] processing error:', err.message);
    // Still return 200 so Campay doesn't retry indefinitely on bugs in our side.
    return res.status(200).json({ ok: false, error: err.message });
  }
};

module.exports = { handleCampayNotify };
```

- [ ] **Step 4: Create the route**

Create `backend/src/modules/payments/payments.routes.js`:

```js
'use strict';

const express = require('express');
const router = express.Router();
const { handleCampayNotify } = require('./payments.controller');

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Inbound payment provider notifications
 */

/**
 * @swagger
 * /payments/campay/notify:
 *   get:
 *     summary: Campay payment notification (GET variant)
 *     tags: [Payments]
 *     description: |
 *       Receives signed payment notifications from Campay. The `signature`
 *       query parameter is a JWT signed with CAMPAY_WEBHOOK_KEY (HS256). The
 *       same endpoint accepts POST with a JSON body of identical shape.
 *     responses:
 *       200: { description: Acknowledged }
 *       401: { description: Invalid or missing signature }
 *   post:
 *     summary: Campay payment notification (POST variant)
 *     tags: [Payments]
 *     responses:
 *       200: { description: Acknowledged }
 *       401: { description: Invalid or missing signature }
 */
router.get('/campay/notify', handleCampayNotify);
router.post('/campay/notify', handleCampayNotify);

module.exports = router;
```

- [ ] **Step 5: Mount the router in `app.js`**

Edit `backend/src/app.js`. Add the import near the other route imports:

```js
const paymentsRoutes = require('./modules/payments/payments.routes');
```

Mount after the other `app.use(...)` lines:

```js
app.use('/payments', paymentsRoutes);
```

- [ ] **Step 6: Run tests**

```bash
CAMPAY_WEBHOOK_KEY=test-key-32-bytes-minimum-for-hs256-signing npx jest tests/integration/campay.webhook.integration.test.js
```

Expected: PASS for all four cases.

Also run the broader suite to catch any regression:

```bash
npx jest tests/unit
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/payments/payments.controller.js \
        backend/src/modules/payments/payments.routes.js \
        backend/src/app.js \
        backend/tests/integration/campay.webhook.integration.test.js
git commit -m "feat(payments): add Campay webhook endpoint with JWT verification"
```

---

## Task 16: PayoutEngine refactor — paymentFactory + two-tier routing

**Files:**
- Modify: `backend/src/engines/PayoutEngine.js`
- Modify: `backend/tests/unit/payout.service.test.js`
- Modify: any wiring code that constructs `PayoutEngine` (e.g. `payout.service.js`)

- [ ] **Step 1: Locate all `new PayoutEngine(` instantiations**

Run:

```bash
npx grep --line-number "new PayoutEngine(" backend/src
```

For each location found, the call needs to be updated in Step 3 below.

- [ ] **Step 2: Write the failing two-tier routing tests**

In `backend/tests/unit/payout.service.test.js`, find the existing PayoutEngine test block (it currently passes a `paymentProvider` to the constructor). Replace its constructor calls so they pass a `paymentFactory` instead. Then add the routing matrix tests:

```js
describe('PayoutEngine — two-tier payout routing', () => {
  let mtnSvc, orangeSvc, campaySvc, paymentFactory;
  let contributionService, notificationService, auditService, fineService;
  let engine;

  beforeEach(() => {
    mtnSvc = { disburse: jest.fn().mockResolvedValue({ success: true, externalRef: 'mtn-1', status: 'SUCCESSFUL' }) };
    orangeSvc = { disburse: jest.fn().mockResolvedValue({ success: true, externalRef: 'or-1', status: 'SUCCESSFUL' }) };
    campaySvc = { disburse: jest.fn().mockResolvedValue({ success: true, externalRef: 'cm-1', status: 'SUCCESSFUL' }) };
    paymentFactory = {
      getProvider: jest.fn((gw) => ({ mtn_momo: mtnSvc, orange_money: orangeSvc, campay: campaySvc }[gw])),
    };
    contributionService = { /* mock per PayoutEngine usage; see existing tests */ };
    notificationService = { /* ... */ };
    auditService = { log: jest.fn() };
    fineService = { /* ... */ };
    engine = new PayoutEngine(contributionService, paymentFactory, notificationService, auditService, fineService);
  });

  // Test helpers: a group fixture and a recipient fixture
  const groupWith = (overrides = {}) => ({
    id: 'g1', preferred_gateway: 'mtn_momo', preferred_payout_gateway: null, ...overrides,
  });
  const recipientWith = (phone) => ({ id: 'r1', phone });

  // Stub out everything PayoutEngine.execute needs except for the disburse step.
  // The existing payout.service.test.js already has stubs for the eligibility
  // and ledger steps — re-use them. The block below assumes such helpers
  // exist; otherwise adapt by mocking `engine.checkEligibility` to always pass.

  it('NULL column + MTN-prefix recipient → MTNMoMoService.disburse', async () => {
    engine.group = groupWith({ preferred_payout_gateway: null });
    engine.recipient = recipientWith('+237672000001');
    await engine._dispatchDisburse(); // helper extracted in Step 4 below

    expect(paymentFactory.getProvider).toHaveBeenCalledWith('mtn_momo');
    expect(mtnSvc.disburse).toHaveBeenCalled();
    expect(orangeSvc.disburse).not.toHaveBeenCalled();
    expect(campaySvc.disburse).not.toHaveBeenCalled();
  });

  it('NULL column + Orange-prefix recipient → OrangeMoneyService.disburse', async () => {
    engine.group = groupWith({ preferred_payout_gateway: null });
    engine.recipient = recipientWith('+237692000001');
    await engine._dispatchDisburse();
    expect(paymentFactory.getProvider).toHaveBeenCalledWith('orange_money');
    expect(orangeSvc.disburse).toHaveBeenCalled();
  });

  it('NULL column + unrecognized prefix → throws .statusCode=400, disburse never called', async () => {
    engine.group = groupWith({ preferred_payout_gateway: null });
    engine.recipient = recipientWith('+233241234567');
    await expect(engine._dispatchDisburse()).rejects.toThrow(expect.objectContaining({ statusCode: 400 }));
    expect(mtnSvc.disburse).not.toHaveBeenCalled();
  });

  it('column=campay + any recipient → CampayService.disburse', async () => {
    engine.group = groupWith({ preferred_payout_gateway: 'campay' });
    engine.recipient = recipientWith('+237672000001');
    await engine._dispatchDisburse();
    expect(paymentFactory.getProvider).toHaveBeenCalledWith('campay');
    expect(campaySvc.disburse).toHaveBeenCalled();
    expect(mtnSvc.disburse).not.toHaveBeenCalled();
  });

  it('column=mtn_momo + any recipient → MTNMoMoService.disburse (phone prefix ignored)', async () => {
    engine.group = groupWith({ preferred_payout_gateway: 'mtn_momo' });
    engine.recipient = recipientWith('+237692000001'); // Orange recipient!
    await engine._dispatchDisburse();
    expect(paymentFactory.getProvider).toHaveBeenCalledWith('mtn_momo');
    expect(mtnSvc.disburse).toHaveBeenCalled();
  });

  it('column=orange_money + any recipient → OrangeMoneyService.disburse', async () => {
    engine.group = groupWith({ preferred_payout_gateway: 'orange_money' });
    engine.recipient = recipientWith('+237672000001');
    await engine._dispatchDisburse();
    expect(paymentFactory.getProvider).toHaveBeenCalledWith('orange_money');
    expect(orangeSvc.disburse).toHaveBeenCalled();
  });

  it('REGRESSION: NULL payout column + campay collection rail → still phone-prefix payout', async () => {
    engine.group = groupWith({ preferred_gateway: 'campay', preferred_payout_gateway: null });
    engine.recipient = recipientWith('+237672000001');
    await engine._dispatchDisburse();
    expect(paymentFactory.getProvider).toHaveBeenCalledWith('mtn_momo');
    expect(campaySvc.disburse).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Update the PayoutEngine constructor**

Edit `backend/src/engines/PayoutEngine.js`. Change the constructor signature:

```js
class PayoutEngine {
  constructor(contributionService, paymentFactory, notificationService, auditService, fineService) {
    this.contributionService = contributionService;
    this.paymentFactory = paymentFactory;
    this.notificationService = notificationService;
    this.auditService = auditService;
    this.fineService = fineService;
  }
```

- [ ] **Step 4: Implement the two-tier dispatcher**

Add a private helper near the top of the class (above `execute()`), and use it inside `execute()`'s step 2:

```js
  /**
   * @private
   * Two-tier payout routing.
   * Returns the provider's disburse result, or throws on routing failures.
   */
  async _dispatchDisburse() {
    const phoneRouter = require('../services/payment/phoneRouter');
    const gateway = this.group.preferred_payout_gateway
      || phoneRouter.resolvePayoutGateway(this.recipient.phone);

    const provider = this.paymentFactory.getProvider(gateway);
    return provider.disburse(this.recipient.phone, this.payout.amount, this.payout.id);
  }
```

And in `execute()`, replace the TODO that called `paymentProvider.disburse(...)` with:

```js
    // Step 2 — Disburse via the two-tier router.
    const result = await this._dispatchDisburse();
```

(`this.group`, `this.recipient`, and `this.payout` are populated earlier in `execute()` — adapt to whatever the existing flow does. If they aren't set on `this`, pass them as args to `_dispatchDisburse(group, recipient, payout)` and update the tests accordingly.)

- [ ] **Step 5: Update wiring code**

For each `new PayoutEngine(...)` location found in Step 1, replace the `paymentProvider` argument with the factory:

```js
const paymentFactory = require('../services/payment/index');
// ... later ...
const engine = new PayoutEngine(contributionService, paymentFactory, notificationService, auditService, fineService);
```

- [ ] **Step 6: Run tests**

```bash
npx jest tests/unit/payout.service.test.js
```

Expected: PASS for the seven-case routing matrix plus any pre-existing tests (now using the factory).

```bash
npx jest tests/unit
```

Expected: full unit suite PASSES.

- [ ] **Step 7: Commit**

```bash
git add backend/src/engines/PayoutEngine.js \
        backend/src/modules/payouts/payout.service.js \
        backend/tests/unit/payout.service.test.js
git commit -m "refactor(payouts): PayoutEngine takes paymentFactory and two-tier routes disburse"
```

---

## Task 17: Smoke test docs + final verification

**Files:**
- Create: `docs/smoke-tests/campay.md`

- [ ] **Step 1: Write the smoke-test checklist**

Create `docs/smoke-tests/campay.md`:

```markdown
# Campay Manual Smoke Test (pre-demo)

> Run this before every panel demo, after any Campay-related code change,
> or whenever the Contabo VPS host or DNS changes.

## Prerequisites

- [ ] Backend deployed to the Contabo VPS with a public HTTPS hostname.
- [ ] `backend/.env` on the server has:
  - [ ] `CAMPAY_APP_USERNAME` — from the Campay dashboard
  - [ ] `CAMPAY_APP_PASSWORD` — from the Campay dashboard
  - [ ] `CAMPAY_WEBHOOK_KEY` — from the Campay dashboard
  - [ ] `CAMPAY_BASE_URL` — default `https://demo.campay.net/api` for sandbox
  - [ ] `CAMPAY_NOTIFY_URL` — `https://<contabo-host>/payments/campay/notify`
- [ ] Campay dashboard: app callback URL is set to the same `CAMPAY_NOTIFY_URL`, method = GET.
- [ ] At least one test njangi group exists with `preferred_gateway = 'campay'`.
- [ ] At least one test member with a valid Campay sandbox MSISDN.

## Test 1 — collection happy path (webhook is primary)

1. Trigger a contribution from the test member.
2. Confirm the USSD/PIN prompt on the test phone; enter the PIN.
3. Within ~30 s:
   - [ ] Campay webhook arrived (check server logs for `[Campay webhook]` lines).
   - [ ] `contributions` row updated to `status = 'SUCCESSFUL'`.
   - [ ] `audit_events` has a row for this contribution.

## Test 2 — polling fallback (webhook deliberately broken)

1. Temporarily change the Campay dashboard callback URL to `https://example.invalid/`.
2. Trigger another contribution; confirm on the test phone.
3. Within 30 s:
   - [ ] Polling completes the contribution (no webhook arrived; ledger still updated).
4. Restore the real callback URL afterwards.

## Test 3 — payout via Campay (if preferred_payout_gateway = 'campay')

1. Set the test group's `preferred_payout_gateway` to `'campay'` via
   `PATCH /groups/<id>/payout-gateway`.
2. Trigger a payout to the test recipient.
3. Within ~30 s:
   - [ ] Recipient's Campay test wallet shows the credit.
   - [ ] `payouts` row updated to `status = 'SUCCESSFUL'`.

## Test 4 — webhook signature rejection

1. Send a hand-crafted GET to `/payments/campay/notify?status=SUCCESSFUL&signature=garbage&...`.
2. Server responds 401 (verify in server logs).

## Rollback

If anything looks wrong:
1. Set the group back to `preferred_gateway = 'mtn_momo'`.
2. Clear `preferred_payout_gateway` (set to NULL via the API).
3. Existing MTN/Orange direct rails take over.
```

- [ ] **Step 2: Run the entire test suite the same way CI does**

The repo's `.github/workflows/ci.yml` runs `npm test -- --coverage` from `backend/`. Match that locally so any failure surfaces here, not in CI:

```bash
cd backend
npm test -- --coverage
```

Expected: every unit test PASSES. Integration tests PASS or skip cleanly (the Campay webhook test skips without `CAMPAY_WEBHOOK_KEY`; the group.api tests skip without `backend/.env.test`).

- [ ] **Step 3: Run ESLint exactly as CI does (blocks the PR if it fails)**

```bash
npm run lint
```

Expected: exit 0 with no errors. The CI workflow runs this same command and will block the PR on any lint error in the new code. If anything fails, fix it before pushing — never use `--no-verify` or suppress errors.

- [ ] **Step 4: Commit the smoke-test doc**

```bash
git add docs/smoke-tests/campay.md
git commit -m "docs(payments): add Campay manual smoke-test checklist"
```

- [ ] **Step 5: Push the branch and open the PR**

```bash
git push -u origin feature/dev-b/campay-gateway
gh pr create --title "feat(payments): Campay integration with two-tier payout routing" --body "$(cat <<'EOF'
## Summary
- Adds Campay as a third PaymentProvider subclass (charge / disburse / getStatus / refund-throws).
- New phoneRouter utility for Cameroon MSISDN → operator detection.
- Two-tier payout routing via new nullable njangi_groups.preferred_payout_gateway column.
- New PATCH /groups/:groupId/gateway and PATCH /groups/:groupId/payout-gateway endpoints (president-only).
- New POST/GET /payments/campay/notify webhook with JWT signature verification.
- PayoutEngine constructor refactor: paymentProvider → paymentFactory.

Spec: docs/superpowers/specs/2026-05-23-campay-gateway-design.md (commit 6ed3a7d)
Plan: docs/superpowers/plans/2026-05-23-campay-payment-gateway.md

## Test plan
- [x] All unit tests pass (`backend/ $ npx jest tests/unit`)
- [ ] Integration tests pass with backend/.env.test configured
- [ ] Manual smoke test per docs/smoke-tests/campay.md against Campay sandbox

🤖 Generated with [claude-flow](https://github.com/ruvnet/claude-flow)
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** §5.1–5.10 of the spec map to Tasks 1–15. §5.6 (PayoutEngine) is Task 16. §8 testing matrix is split across Tasks 1, 2, 4–8 (unit) and 12, 13, 15 (integration). §6.4 (webhook flow) is Task 14 + 15.
- **Default behavior preserved:** Task 9's migration uses `DEFAULT 'mtn_momo'` for `preferred_gateway` and leaves `preferred_payout_gateway` nullable, so existing groups are functionally unchanged.
- **OOP demo target:** All four PaymentProvider methods on `CampayService` are real (Tasks 6/7/8) — `refund` is the only throw, matching the existing MTN and Orange behavior.
- **Type consistency:** `CampayService.charge`/`disburse` return `{ success, externalRef, status }` everywhere; `applyTerminalStatus` returns `{ updated: boolean, reason?: string }` consistently in service code and tests.
- **Webhook → ledger path:** `paymentsService.applyTerminalStatus` dispatches on `endpoint` ('collect' → contributions; 'withdraw' → payouts) and is shared by both webhook (Task 15) and any future polling-driven completion that wants the same idempotent write.

## Open implementation notes (NOT placeholders — these are knowns the implementer should expect)

- The contributions/payouts table column names (`external_ref`, `paid_at`, `failed_at`, `status`) match the project's existing schema. If the actual schema uses different field names, adjust Tasks 14 + 16 accordingly.
- If `payout.service.test.js` has existing PayoutEngine tests with a different fixture structure, adapt Task 16's tests to match the prevailing pattern rather than introducing a parallel one.
- `auditService.log` is best-effort and never throws — controllers can `await` it freely without try/catch (already the pattern in AuditService.js).

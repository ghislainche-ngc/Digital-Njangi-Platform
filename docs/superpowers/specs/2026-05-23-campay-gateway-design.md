# Monetbil Payment Gateway — Design Spec

| Field         | Value                                                       |
| ------------- | ----------------------------------------------------------- |
| Status        | Approved (brainstorming) — pending implementation plan      |
| Date          | 2026-05-23                                                  |
| Author        | Ghislain (Dev B — Payments)                                 |
| Course rubric | [SEN2241 final exam spec](../../requirements/SEN2241-final-exam-spec.md) |
| Branch        | `feature/dev-b/monetbil-gateway`                            |
| Phase target  | Phase 1 (Monetbil collection only) — cards/widget deferred  |

## 1. Summary

Add **Monetbil** as a third `PaymentProvider` implementation alongside `MTNMoMoService` and `OrangeMoneyService`, so that njangi groups can opt to route their **member-contribution collection** through Monetbil's aggregator API (which covers MTN Mobile Money, Orange Money, and Express Union Mobile Money in Cameroon under one integration).

Payouts (disbursements to the rotation winner) **continue to use the existing MTN/Orange direct APIs**, routed by the recipient's phone prefix. Monetbil v1 does not support disbursement; this design is honest about that constraint and never asks Monetbil to perform a payout.

## 2. Goals

- **G1.** Members in groups that opt in can have contributions debited via Monetbil's `placePayment` API. The current MTN and Orange direct flows are preserved unchanged for groups that do not opt in.
- **G2.** Group admins can change a group's preferred collection rail at runtime via a new `PATCH /api/groups/:id/gateway` endpoint.
- **G3.** Payout routing is deterministic and safe: payouts are always sent to the recipient's native operator (MTN or Orange), never via Monetbil.
- **G4.** Add a third concrete subclass to the `PaymentProvider` hierarchy to strengthen the OOP demonstration (4 pillars + Liskov substitutability) for the SEN2241 panel.
- **G5.** No changes to the `PaymentProvider` interface — existing callers (`ContributionService`, `PayoutEngine`) are untouched at the contract level. Only `PayoutEngine` gains a one-line gateway-resolver call.

## 3. Non-goals (Phase 2 / future work)

- **N1.** Card (Visa/Mastercard) payments. Monetbil v1 is Momo + carrier-billing only; cards require the Monetbil Payment Widget (hosted redirect flow), out of scope.
- **N2.** Monetbil disbursement. Not present in v1 docs.
- **N3.** Multi-country support (Senegal, Congo, Uganda, Benin, etc. — listed in Monetbil's operators table but not relevant for NAAS yet).
- **N4.** Express Union Momo (`CM_EUMM`) — listed as a Cameroon operator, but no NAAS users today.
- **N5.** Automatic retries on `TIMEOUT` results. Phase 1 records the pending state and lets an admin resolve manually.
- **N6.** A frontend "Payment settings" UI for the gateway-change endpoint. The endpoint itself ships in Phase 1; the UI is frontend scope.
- **N7.** SaaS subscription billing for NAAS itself (Clerk Billing / Stripe). Wrong tool for the njangi flow; Cameroon merchant availability is also a blocker.
- **N8.** End-to-end automated tests against the real Monetbil sandbox. Sandbox requires a public `notify_url`; this stays a manual pre-demo smoke test.

## 4. Architecture

`MonetbilService` joins `MTNMoMoService` and `OrangeMoneyService` as a third concrete subclass of `PaymentProvider`. No interface changes.

```
                       ┌──────────────────────────────┐
                       │  PaymentProvider (abstract)  │
                       └──────────────┬───────────────┘
                ┌─────────────────────┼─────────────────────┐
                ▼                     ▼                     ▼
        MTNMoMoService        OrangeMoneyService     MonetbilService
        charge ✓               charge ✓               charge ✓
        disburse ✓             disburse ✓             disburse ✗ (throws)
        getStatus ✓            getStatus ✓            getStatus ✓
        refund ✗               refund ✗               refund ✗

  Collection rail per group :  njangi_groups.preferred_gateway
                                  ('mtn_momo' | 'orange_money' | 'monetbil')
                                  → factory.getProvider(...)
  Payout rail per recipient :  phoneRouter.resolvePayoutGateway(phone)
                                  ('mtn_momo' | 'orange_money')
                                  → factory.getProvider(...)
                                  Monetbil is NEVER chosen.
```

The two routing concerns are deliberately separated:

- **Collection routing** is a configuration decision (admin-set, per-group).
- **Payout routing** is a physics decision (the recipient's wallet lives on exactly one operator).

## 5. Components

### 5.1 `backend/src/services/payment/MonetbilService.js` *(new)*

Extends `PaymentProvider`. Mirrors the shape of the existing two services so the factory swap is purely polymorphic.

**Public methods:**

- `charge(phone, amount)` — builds the `placePayment` payload, calls Monetbil, polls `checkPayment` until terminal, returns `{ success, externalRef, status }`.
- `getStatus(externalRef)` — single `checkPayment` call. Returns the mapped status string.
- `disburse(_phone, _amount)` — throws `Error('Monetbil v1 does not support disbursement')` with `.statusCode = 501`.
- `refund(_externalRef)` — throws `Error('Monetbil does not support native refunds')`.

**Private helpers:**

- `_detectOperator(phone)` — thin wrapper over `phoneRouter.detectOperatorFromPhone`; maps `'mtn'` → `'CM_MTNMOBILEMONEY'`, `'orange'` → `'CM_ORANGEMONEY'`. Throws (`.statusCode = 400`) on unrecognized prefix.
- `_pollStatus(paymentId)` — loops `POST /checkPayment` every 2 s until the response's top-level `message` is no longer `"payment pending"`, or until a 30 s deadline. Mirrors `MTNMoMoService._pollStatus`. Returns mapped status string or `'TIMEOUT'`.

**Constructor config (from `index.js`):**

```js
{
  serviceKey: process.env.MONETBIL_SERVICE_KEY,
  baseUrl:    process.env.MONETBIL_BASE_URL    || 'https://api.monetbil.com/payment/v1',
  notifyUrl:  process.env.MONETBIL_NOTIFY_URL  || '',  // optional; unused in Phase 1
}
```

### 5.2 `backend/src/services/payment/phoneRouter.js` *(new, ~30 lines)*

Pure functions. No state. Single source of truth for Cameroon MSISDN-prefix logic.

- `detectOperatorFromPhone(phone)` → `'mtn' | 'orange' | null`. Uses the prefix table from the Monetbil API doc (p. 10).
- `resolvePayoutGateway(phone)` → `'mtn_momo' | 'orange_money'`. Throws (`.statusCode = 400`) on unrecognized prefix. Never returns `'monetbil'`.

Tables encoded as constants at the top of the file:

```js
const MTN_PREFIXES    = ['67', '650', '651', '652', '653', '654',
                         '680', '681', '682', '683', '684'];
const ORANGE_PREFIXES = ['69', '655', '656', '657', '658', '659',
                         '685', '686', '687', '688', '689'];
```

Lookup strips the `+237` country code, then matches longest-prefix-first.

### 5.3 `backend/src/services/payment/index.js` *(modified)*

Adds a `monetbil` block to the `config` object and a `case 'monetbil':` to `getProvider`. Throws at construction time if `MONETBIL_SERVICE_KEY` is missing — fail loudly, not silently.

### 5.4 `backend/src/modules/groups/group.service.js` *(modified — extend existing)*

Add `updateGateway(groupId, gateway)`. Follows the module's existing convention (uses the imported `supabase` client directly — does **not** introduce constructor `db` injection, since this module wasn't refactored to DI yet):

```js
async updateGateway(groupId, gateway) {
  if (!['mtn_momo', 'orange_money', 'monetbil'].includes(gateway)) {
    const e = new Error('invalid gateway');
    e.statusCode = 400;
    throw e;
  }
  const { data, error } = await supabase
    .from('njangi_groups')
    .update({ preferred_gateway: gateway })
    .eq('id', groupId)
    .select()
    .single();
  if (error || !data) {
    const e = new Error('group not found');
    e.statusCode = error ? 500 : 404;
    throw e;
  }
  return data;
}
```

A controller wrapper is added to `group.controller.js`, and validation to `group.validation.js`, both following the existing patterns in those files.

### 5.5 `backend/src/modules/groups/group.routes.js` *(modified — add one route)*

```
PATCH /groups/:groupId/gateway
  ⨯ auth                          (existing — backend/src/middleware/auth.middleware.js)
  ⨯ tenant                        (existing — sets req.membership)
  ⨯ requireRole('president')      (existing — backend/src/middleware/role.middleware.js;
                                    same pattern used by the existing PATCH /groups/:groupId)
  ⨯ body validation               ({ gateway: 'mtn_momo' | 'orange_money' | 'monetbil' })
  ⨯ updateGateway controller      → group.service.updateGateway(id, gateway)
  ⨯ auditService.log(groupId, callerUserId, 'GATEWAY_CHANGED',
                     { from: oldGateway, to: gateway })
  ⨯ 200 { ...group }
```

Note the actual base path: existing groups routes are mounted at `/groups`, so the full URL is `PATCH /api/groups/:groupId/gateway` (verifying the `app.js` mount during implementation). The `requireRole('president')` line mirrors line 102 of the existing `group.routes.js`. Swagger annotation added inline in the same JSDoc style used by the surrounding routes.

### 5.6 `backend/src/engines/PayoutEngine.js` *(modified — constructor signature change + one disburse line)*

The current constructor takes a single `paymentProvider` instance. To dispatch by recipient phone prefix, that parameter is replaced with `paymentFactory` (the existing factory exported from `backend/src/services/payment/index.js`):

```js
// before:
constructor(contributionService, paymentProvider, notificationService, auditService, fineService)

// after:
constructor(contributionService, paymentFactory, notificationService, auditService, fineService)
```

Then inside `execute()`'s step 2:

```js
const gateway = phoneRouter.resolvePayoutGateway(recipient.phone);
const provider = this.paymentFactory.getProvider(gateway);
const result = await provider.disburse(recipient.phone, payout.amount);
```

This is a **breaking constructor change** — existing `PayoutEngine` instantiations and tests must be updated. The current implementation has step 2 stubbed (TODO comment), so the impact is limited to the test surface and any wiring code that constructs the engine. Documented as part of the implementation plan.

### 5.7 Database migration *(new SQL file alongside `backend/src/config/schema.sql`)*

Migration goes into a new file at `backend/src/config/migrations/2026-05-23-add-preferred-gateway.sql` (creating the `migrations/` folder under `config/` if not present), and is also reflected in `schema.sql` so a fresh setup picks it up:

```sql
ALTER TABLE njangi_groups
  ADD COLUMN preferred_gateway text NOT NULL DEFAULT 'mtn_momo'
    CHECK (preferred_gateway IN ('mtn_momo', 'orange_money', 'monetbil'));
```

The default is `'mtn_momo'` so existing groups continue to behave identically until an admin opts them in. The exact location of the migrations folder is finalized during implementation — the goal is to follow whatever convention the team adopts; if `schema.sql` updates are the only convention so far, the `ALTER` simply lands there.

### 5.8 `backend/.env.example` *(modified)*

Three new placeholders:

```
MONETBIL_SERVICE_KEY=
MONETBIL_BASE_URL=https://api.monetbil.com/payment/v1
MONETBIL_NOTIFY_URL=
```

Real values live in `backend/.env` (gitignored).

## 6. Data flow

### 6.1 Collection — `njangi_groups.preferred_gateway = 'monetbil'`

```
ContributionService.recordContribution(groupId, memberId, amount)
        │
        ▼
  Look up njangi_groups.preferred_gateway = 'monetbil'
        │
        ▼
  factory.getProvider('monetbil') → MonetbilService
        │
        ▼
  MonetbilService.charge(phone='+237677000001', amount=5000)
        │
        ├─ _detectOperator('+237677000001') → 'CM_MTNMOBILEMONEY'
        │
        ├─ POST https://api.monetbil.com/payment/v1/placePayment
        │     { service, phonenumber, amount,
        │       operator: 'CM_MTNMOBILEMONEY',
        │       country:  'CM',
        │       currency: 'XAF',
        │       payment_ref: <NAAS contribution UUID> }
        │   ← { status: 'REQUEST_ACCEPTED', paymentId: '17759…',
        │       message: 'payment pending' }
        │
        └─ Loop every 2 s, max 30 s:
            POST /checkPayment { paymentId }
              ← { message: 'payment pending' }                  → keep polling
              ← { message: 'payment finish',
                  transaction: { status: 1 } }                  → break, map status

  Status map:
    1   → 'SUCCESSFUL'   (success = true)
    0   → 'FAILED'       (success = false, no throw)
   -1   → 'CANCELLED'    (success = false, no throw)
   -2   → 'REFUNDED'     (success = false, no throw)
   poll-deadline reached → 'TIMEOUT' (success = false, no throw)

  Service returns { success, externalRef: paymentId, status }
        │
        ▼
  ContributionService writes ledger row (status, externalRef, paid_at)
```

**Idempotency.** The `payment_ref` sent to Monetbil is the NAAS contribution UUID. On retry (network blip, double-tap), Monetbil sees the same `payment_ref` and dedupes server-side. **We never generate a new UUID per retry.**

### 6.2 Payout — Monetbil is never chosen

```
PayoutEngine.execute(groupId, recipientId)
        │
        ▼
  checkEligibility(...)   → all 4 checks pass
        │
        ▼
  Get recipient.phone, payout.amount
        │
        ▼
  phoneRouter.resolvePayoutGateway('+237677000001') → 'mtn_momo'
        │       (NEVER 'monetbil' — Monetbil v1 has no disbursement)
        ▼
  factory.getProvider('mtn_momo') → MTNMoMoService
        │
        ▼
  MTNMoMoService.disburse(phone, amount)   ← unchanged
        │
        ▼
  Update ledger → advance rotation → notify members
```

### 6.3 Admin endpoint — `PATCH /api/groups/:groupId/gateway`

```
PATCH /api/groups/:groupId/gateway
Authorization: Bearer <jwt>
Body: { "gateway": "monetbil" }

  ─ auth                          (existing middleware)
  ─ tenant                        (existing — populates req.membership)
  ─ requireRole('president')      (existing — same as PATCH /groups/:groupId)
  ─ body.gateway ∈ allowed set    (else 400)
  ─ group.service.updateGateway(groupId, gateway)
  ─ auditService.log(groupId, callerUserId, 'GATEWAY_CHANGED',
                     { from: oldGateway, to: gateway })
  ─ 200 { id, name, preferred_gateway, ... }
```

## 7. Error handling

Project convention: services throw errors with `.statusCode`; route handlers respond with `err.statusCode || 500`.

| Failure mode                                                  | Where                                  | Behavior                                                                                                                  |
| ------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Unrecognized phone prefix                                     | `phoneRouter.*`                        | Throw `.statusCode = 400` with descriptive message.                                                                       |
| `placePayment` returns non-`REQUEST_ACCEPTED`                 | `MonetbilService.charge`               | Throw `.statusCode = 502`, include Monetbil's `status` and `message` in error text.                                       |
| `placePayment` HTTP 4xx/5xx                                   | `MonetbilService.charge`               | Throw `.statusCode = 502`.                                                                                                |
| `_pollStatus` deadline reached                                | `MonetbilService._pollStatus`          | Return `'TIMEOUT'`. `charge` returns `{ success: false, status: 'TIMEOUT', externalRef: paymentId }`. **Does not throw.** |
| `checkPayment` returns `transaction.status: 0 / -1 / -2`      | `MonetbilService.charge`               | Map to `FAILED` / `CANCELLED` / `REFUNDED`. Return `{ success: false, ... }`. **Does not throw.**                         |
| Network/`fetch` rejects                                       | `MonetbilService.charge`               | Throw `.statusCode = 503` with `'Monetbil network error: ...'`.                                                           |
| `MonetbilService.disburse()` invoked (defensive — router blocks) | `MonetbilService.disburse`           | Throw `.statusCode = 501`.                                                                                                |
| `PATCH gateway` — invalid value                               | Route validation                       | 400 `{ error: 'invalid gateway', allowed: [...] }`.                                                                       |
| `PATCH gateway` — caller not group admin                      | `requireGroupAdmin`                    | 403 `{ error: 'only group admin can change payment gateway' }`.                                                           |
| `PATCH gateway` — group not found                              | `group.service.updateGateway`          | Throw `.statusCode = 404`. Route responds 404.                                                                            |
| Missing `MONETBIL_SERVICE_KEY` at first use                   | `factory.getProvider('monetbil')`      | Throw `.statusCode = 500` with `'MONETBIL_SERVICE_KEY is not configured'`. Fail loudly.                                   |

**Logging.** Errors from `MonetbilService` are logged via the existing audit/log path with the `paymentId` (and our `payment_ref`) for cross-system correlation. Phone numbers are masked to last 3 digits in logs.

**Retry policy.** None in Phase 1. `payment_ref` deduplication on the Monetbil side makes manual retry safe; automatic retry without a backoff/dedup strategy isn't worth the complexity for the demo.

## 8. Testing

Unit tests are mock-first (London school); integration tests are skip-guarded against `backend/.env.test`.

### 8.1 Unit (no network, no DB)

**`backend/tests/unit/phoneRouter.test.js`** *(new)*
- Table-driven coverage of every MTN prefix and every Orange prefix (Monetbil docs p. 10).
- `null` for non-Cameroon prefixes (`+233...`), wrong length, non-numeric junk.
- `resolvePayoutGateway` returns `'mtn_momo'` / `'orange_money'`; throws `.statusCode = 400` on unrecognized prefix; never returns `'monetbil'`.

**Monetbil tests added to existing `backend/tests/unit/payment.service.test.js`** *(extend, not new — this file already covers PaymentProvider, MTNMoMoService, OrangeMoneyService)*
- `charge` happy path: fetch returns `REQUEST_ACCEPTED`, polling returns `status: 1`, service returns `{ success: true, status: 'SUCCESSFUL' }`. Assert the request payload's `payment_ref` matches what the caller passed.
- `charge` failed (`status: 0`) → `{ success: false, status: 'FAILED' }`, no throw.
- `charge` cancelled (`status: -1`) → `{ success: false, status: 'CANCELLED' }`, no throw.
- `charge` timeout: polling always returns `payment pending`; use Jest fake timers to advance past 30 s → `{ success: false, status: 'TIMEOUT' }`, no throw.
- `charge` operator-detection failure: phone `+233...` → throws `.statusCode = 400`. **Fetch is never called.**
- `charge` upstream error: `placePayment` returns `INVALID_AMOUNT` → throws `.statusCode = 502` including Monetbil's message.
- `disburse` throws `.statusCode = 501` regardless of input. Fetch is never called.
- `refund` throws regardless of input.
- `getStatus` returns mapped status from a single `/checkPayment` call.

**`backend/tests/unit/group.service.test.js`** *(extend existing if present, else new)*
- `updateGateway('group-uuid', 'monetbil')` issues the correct Supabase update on the `njangi_groups` table; mock the `supabase` import.
- Invalid gateway value → throws `.statusCode = 400` before hitting Supabase.
- Group not found → throws `.statusCode = 404`.

**PayoutEngine routing tests** *(extend `backend/tests/unit/payout.service.test.js`, or add a new sibling `payoutEngine.test.js` if the engine warrants dedicated coverage)*
- Update constructor wiring across all existing PayoutEngine instantiations to pass `paymentFactory` instead of `paymentProvider`.
- **Critical regression:** a group with `preferred_gateway: 'monetbil'` and an MTN-prefixed recipient must call `MTNMoMoService.disburse`, **never** `MonetbilService.disburse`. Asserted via mocks on `phoneRouter` and `paymentFactory.getProvider`.
- Orange-prefixed recipient → `OrangeMoneyService.disburse`.
- Unrecognized prefix → `resolvePayoutGateway` throws `.statusCode = 400`; eligibility check surfaces the failure; `disburse` never called.

### 8.2 Integration (skip-guarded — only run with `backend/.env.test`)

**Gateway endpoint tests added to existing `backend/tests/integration/group.api.test.js`** *(extend)*
- `PATCH /api/groups/:groupId/gateway` with president JWT → 200, row updated in `njangi_groups`, audit log row written.
- Same request with non-president JWT (member role) → 403.
- Invalid `gateway` value → 400.
- Non-existent group ID → 404.

**Factory test added to existing `backend/tests/unit/payment.service.test.js`** *(extend)*
- `getProvider('monetbil')` returns a `MonetbilService` instance when env is set.
- Behavior when `MONETBIL_SERVICE_KEY` is unset is exercised in unit tests (no live env needed).

### 8.3 Manual smoke test (pre-demo)

A short checklist in `docs/smoke-tests/monetbil.md` (created in implementation):

1. Set real `MONETBIL_SERVICE_KEY` in a dev `.env`.
2. From a test group with `preferred_gateway = 'monetbil'`, trigger a contribution with a sandbox MTN test number.
3. Confirm SMS arrives, confirm transaction, observe ledger update.
4. Repeat for an Orange sandbox number.

### 8.4 Coverage and merge gate

- No new coverage threshold introduced — match the existing project bar.
- Per the branching rule, the feature branch only merges to main when `npm test` (from `backend/`) exits clean. No `.skip` shortcuts.

## 9. Out of scope (Phase 2 / future)

See §3 (Non-goals) for the full table. Headline items recapped:

- Card payments via Monetbil Payment Widget (`MonetbilWidgetService` with a `notify_url` webhook).
- Monetbil disbursement (if the product ships).
- Express Union (`CM_EUMM`) — trivial 1-line addition to `phoneRouter`.
- Multi-country support (Senegal, Congo, Uganda, etc.).
- Automatic retry on `TIMEOUT` via a background worker.
- Frontend "Payment settings" UI for the gateway-change endpoint.
- SaaS subscription billing for NAAS itself (Clerk Billing / Stripe — wrong tool for the njangi flow; Cameroon merchant availability blocker).

## 10. References

- **Monetbil Payment API v1 PDF** (attached during brainstorming) — `placePayment` / `checkPayment` endpoints, operators table (p. 10), status code map.
- **Lecturer's grading rubric:** [SEN2241 final exam spec](../../requirements/SEN2241-final-exam-spec.md). Notes that ≥ 5 sequence diagrams are required — the collection flow (§6.1), payout flow (§6.2), and gateway-change endpoint (§6.3) each contribute one.
- **Existing implementations to mirror:**
  - [backend/src/services/payment/MTNMoMoService.js](../../../backend/src/services/payment/MTNMoMoService.js)
  - [backend/src/services/payment/OrangeMoneyService.js](../../../backend/src/services/payment/OrangeMoneyService.js)
  - [backend/src/services/payment/PaymentProvider.js](../../../backend/src/services/payment/PaymentProvider.js)
  - [backend/src/services/payment/index.js](../../../backend/src/services/payment/index.js)
  - [backend/src/engines/PayoutEngine.js](../../../backend/src/engines/PayoutEngine.js)
- **OOP demonstration target:** abstract base class + three concrete subclasses + a factory + Liskov substitution evidence (any code that holds a `PaymentProvider` reference works identically with all three implementations, except where the contract explicitly declares "not supported" — modeled as throws on `disburse` for Monetbil).

## 11. Open questions

None — all clarifying questions resolved during brainstorming:

- Gateway choice scope → per group (admin-set column). ✓
- Payout routing → always by recipient's phone prefix; Monetbil never chosen. ✓
- Cards in Phase 1 → no (deferred to Phase 2 widget). ✓
- Stripe / Clerk Billing → no (wrong tool for this flow). ✓
- API endpoint for gateway change → yes, `PATCH /api/groups/:id/gateway`. ✓

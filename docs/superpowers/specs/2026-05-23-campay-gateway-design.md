# Campay Payment Gateway — Design Spec

| Field         | Value                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| Status        | Approved (brainstorming) — pending implementation plan                                  |
| Date          | 2026-05-23                                                                              |
| Author        | Ghislain (Dev B — Payments)                                                             |
| Course rubric | [SEN2241 final exam spec](../../requirements/SEN2241-final-exam-spec.md)               |
| Branch        | `feature/dev-b/campay-gateway`                                                          |
| Phase target  | Phase 1 — Campay collection + disbursement-capable subclass + webhook + JWT signature   |
| Supersedes    | Monetbil design at commit `c0ce287` (abandoned — KYC/admin-approval onboarding too slow)|

## 1. Summary

Add **Campay** ([campay.net](https://campay.net)) as a third `PaymentProvider` implementation alongside `MTNMoMoService` and `OrangeMoneyService`. Njangi groups can opt to route their **member-contribution collection** through Campay's aggregator API, which covers MTN Mobile Money and Orange Money in Cameroon under one HTTP integration with automatic operator detection from the phone prefix.

Unlike Monetbil (the previously evaluated provider), Campay's API includes a documented **disbursement endpoint** (`/api/withdraw/`), so `CampayService.disburse()` is a real implementation — not a stub-that-throws. Payouts use a **two-tier routing scheme** so admins can opt their group into Campay disbursement when they want it, and the system defaults to direct-rail routing otherwise:

- A new nullable column `njangi_groups.preferred_payout_gateway` lets a group's president set the payout rail explicitly.
- When the column is `NULL` (the default for every existing group), payouts fall back to **phone-prefix routing** — the recipient's native MTN/Orange direct API. This preserves today's behavior.
- When the column is `'campay'`, payouts go through `CampayService.disburse()` (the `/api/withdraw/` endpoint).
- `'mtn_momo'` and `'orange_money'` are also accepted column values, but only sensible for single-operator groups. (If the column says `mtn_momo` and a recipient is on Orange, MTN's API will reject — that constraint is the admin's responsibility to honor.)

Collection completion is handled by **both** Campay's notification webhook (primary — the moment Campay knows the final status) **and** synchronous polling against `/api/transaction/(reference)/` (fallback — covers webhook drops or short outages of our public URL). Webhook authenticity is verified by **JWT signature** using the `CAMPAY_WEBHOOK_KEY` configured per Campay app.

### Why Campay (not Monetbil)

Monetbil's onboarding required submission of business identification documents followed by admin review before issuing API credentials — a multi-day timeline that does not fit the SEN2241 implementation window. Campay offers a self-service sandbox at `demo.campay.net` with immediate credential issuance, plus disbursement support that Monetbil v1 lacks. The architectural decisions from the abandoned Monetbil design (PaymentProvider abstraction, phoneRouter for payout routing, `preferred_gateway` column, PayoutEngine refactor, dual-path completion model) all carry over unchanged — only the provider-specific service class changes.

## 2. Goals

- **G1.** Members in groups that opt in can have contributions debited via Campay's `POST /api/collect/`. Existing MTN/Orange direct flows are preserved unchanged for groups that do not opt in.
- **G2.** Group admins can change a group's preferred collection rail at runtime via `PATCH /api/groups/:groupId/gateway`.
- **G3.** Payout routing is **two-tier and explicit**. A group's `preferred_payout_gateway` column (nullable) is consulted first; when set, payouts use that gateway directly (including `'campay'`). When `NULL`, payouts fall back to phone-prefix routing through the recipient's native MTN/Orange direct API. The phone-prefix fallback preserves today's behavior for every existing group.
- **G4.** Strengthen the OOP demonstration for the SEN2241 panel: a third concrete `PaymentProvider` subclass with all four methods (`charge`, `disburse`, `getStatus`, `refund`) implemented or honestly declined, showing Liskov substitutability.
- **G5.** No changes to the `PaymentProvider` interface — existing callers (`ContributionService`, `PayoutEngine`) interact polymorphically.
- **G6.** **Webhook completion path.** A new `/api/payments/campay/notify` endpoint (GET *and* POST, per Campay docs) accepts Campay's payment notifications, verifies the JWT signature using `CAMPAY_WEBHOOK_KEY`, and updates the contribution ledger idempotently. The webhook is the primary completion mechanism; polling is the fallback.

## 3. Non-goals (Phase 2 / future work)

- **N1.** Card (Visa/Mastercard) payments. Campay, like Monetbil, processes Momo only — neither provider supports cards. A real card integration would require a different processor (Flutterwave/Paystack), and Stripe is blocked by Cameroon merchant unavailability.
- **N2.** ~~Routing payouts through Campay~~ — **moved into scope.** Originally deferred to Phase 2 for reliability concerns; reconsidered during brainstorming. Now configurable per-group via `preferred_payout_gateway` (default `NULL` → phone-prefix direct routing, preserving the original reliability story for groups that don't opt in).
- **N3.** Multi-country support — Campay is Cameroon-only and NAAS is Cameroon-only.
- **N4.** Automatic retries on `TIMEOUT`/`PENDING` results. Phase 1 records the pending state; the webhook resolves it later if/when it arrives, or admin resolves it manually.
- **N5.** A frontend "Payment settings" UI for the gateway-change endpoint. The endpoint itself ships in Phase 1; the UI is frontend scope.
- **N6.** SaaS subscription billing for NAAS itself (Clerk Billing / Stripe). Wrong tool for the njangi flow; Cameroon merchant availability is also a blocker.
- **N7.** End-to-end automated tests against the real Campay sandbox. Webhook tests require Campay reaching our public URL; this stays a manual pre-demo smoke test from the Contabo VPS.
- **N8.** Campay **JavaScript Widget** integration (`demo.campay.net/sdk/js?app-id=...`). Our PaymentProvider abstraction is server-side; the widget is a frontend pattern that bypasses the abstraction. Could be added later as a complementary frontend path.

## 4. Architecture

```
                       ┌──────────────────────────────┐
                       │  PaymentProvider (abstract)  │
                       └──────────────┬───────────────┘
                ┌─────────────────────┼─────────────────────┐
                ▼                     ▼                     ▼
        MTNMoMoService        OrangeMoneyService       CampayService
        charge ✓               charge ✓                 charge ✓
        disburse ✓             disburse ✓               disburse ✓ (chosen when
        getStatus ✓            getStatus ✓                          preferred_payout
        refund ✗               refund ✗                             _gateway='campay')
                                                          getStatus ✓
                                                          refund ✗

  Collection rail (per group) :  njangi_groups.preferred_gateway
                                    ('mtn_momo' | 'orange_money' | 'campay')
                                    → factory.getProvider(...)

  Payout rail (two-tier)      :  IF njangi_groups.preferred_payout_gateway IS NOT NULL
                                    → factory.getProvider(that column)
                                 ELSE
                                    → factory.getProvider(
                                        phoneRouter.resolvePayoutGateway(recipient.phone)
                                      )
                                    (always 'mtn_momo' or 'orange_money')

  Completion for Campay charges (BOTH paths converge on the same ledger update):
       ┌──────────────────────────────────┐         ┌──────────────────────────────┐
       │ A) Polling (in CampayService)    │         │ B) Webhook (notify endpoint) │
       │    GET /api/transaction/<ref>/   │         │    GET or POST /campay/notify│
       │    loop until terminal or 30s    │         │    verify JWT sig + apply    │
       └──────────────┬───────────────────┘         └──────────────┬───────────────┘
                      │                                            │
                      └────────────────┬───────────────────────────┘
                                       ▼
                        Idempotent ledger update
                        (by external_reference = contribution UUID;
                         already-terminal rows are no-op'd)
```

The collection and payout routing concerns remain deliberately separated, with the payout side now having two configurable layers:

- **Collection routing** is a configuration decision (admin-set, per-group, via `preferred_gateway`).
- **Payout routing** is admin-configurable too, via `preferred_payout_gateway`. When unset, the system falls back to phone-prefix routing — the recipient's native operator. This default preserves today's behavior for every group that doesn't opt in.

The two completion paths (polling + webhook) are deliberately redundant. Whichever path arrives first writes the terminal status; the other's later arrival is a no-op because the ledger update is idempotent on `external_reference`. **Campay also dedupes server-side on `external_reference`**, so retries to `/collect/` with the same UUID return the original result — making the dual-path safe even if both fire requests against Campay.

## 5. Components

### 5.1 `backend/src/services/payment/CampayService.js` *(new)*

Extends `PaymentProvider`. Mirrors the shape of the existing two services so the factory swap is purely polymorphic.

**Public methods (all four behave correctly):**

- `charge(phone, amount, paymentRef)` — normalizes the phone (`+237...` → `237...`), stringifies the amount, calls `POST /api/collect/` with `external_reference = paymentRef` (the caller's contribution UUID), then polls `GET /api/transaction/<reference>/` until terminal. Returns `{ success, externalRef, status }`. Campay dedupes server-side on `external_reference`, so retries are inherently safe.
- `disburse(phone, amount, paymentRef)` — analogous to `charge`, hits `POST /api/withdraw/` with the recipient's phone in the `to` field. Returns the same shape. **Invoked by `PayoutEngine` when the group's `preferred_payout_gateway = 'campay'`** (see §5.6, §6.2).
- `getStatus(externalRef)` — single `GET /api/transaction/<externalRef>/` call. Returns the mapped status string.
- `refund(_externalRef)` — throws `Error('Campay does not support native refunds')`. (Same as the other two providers.)

**Authentication and token cache:**

`/api/token/` returns a JWT with `expires_in: 3600` (1 hour). The service maintains an in-memory cache:

```js
class CampayService extends PaymentProvider {
  constructor(config) {
    super(config);
    this.username = config.username;
    this.password = config.password;
    this.baseUrl  = config.baseUrl || 'https://demo.campay.net/api';
    this._token   = null;
    this._tokenExpiresAt = 0;   // unix ms
  }

  async _getToken() {
    const now = Date.now();
    // refresh 5 min before expiry to absorb clock skew + network latency
    if (this._token && now < this._tokenExpiresAt - 5 * 60_000) {
      return this._token;
    }
    const res = await fetch(`${this.baseUrl}/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.username, password: this.password }),
    });
    if (!res.ok) { /* throw with .statusCode = 502 */ }
    const data = await res.json();
    this._token = data.token;
    this._tokenExpiresAt = now + (data.expires_in * 1000);
    return this._token;
  }
}
```

Every public method calls `_getToken()` first, then attaches `Authorization: Token <jwt>` to the actual API call. On a 401 from the API, the service clears the cache once and retries (covers stale-token edge cases at the expiry boundary).

**Private helpers:**

- `_normalizePhone(phone)` — strips the `+` from E.164 so `+237677000001` becomes `237677000001`. Throws (`.statusCode = 400`) if the input does not start with `+237`.
- `_pollStatus(reference)` — polls `GET /api/transaction/<reference>/` every 2 s, max 30 s. Stops as soon as the response's `status` field is not `"PENDING"`. May short-circuit early if the caller's ledger row was already updated to terminal by the webhook.

**Status mapping:**

| Campay value (`status` field)  | Internal status | `success` |
| ------------------------------ | --------------- | --------- |
| `"SUCCESSFUL"`                 | `SUCCESSFUL`    | true      |
| `"FAILED"`                     | `FAILED`        | false     |
| `"PENDING"` (polling deadline) | `TIMEOUT`       | false     |

The webhook path uses the **same** uppercase string values (`SUCCESSFUL`/`FAILED`) directly — no separate mapping table needed.

**Constructor config (from `index.js`):**

```js
{
  username: process.env.CAMPAY_APP_USERNAME,
  password: process.env.CAMPAY_APP_PASSWORD,
  baseUrl:  process.env.CAMPAY_BASE_URL || 'https://demo.campay.net/api',
}
```

### 5.2 `backend/src/services/payment/phoneRouter.js` *(new, ~30 lines)*

Pure functions. No state. Single source of truth for Cameroon MSISDN-prefix logic.

- `detectOperatorFromPhone(phone)` → `'mtn' | 'orange' | null`. Uses the Cameroon operator prefix table.
- `resolvePayoutGateway(phone)` → `'mtn_momo' | 'orange_money'`. Throws (`.statusCode = 400`) on unrecognized prefix. **Never returns `'campay'`** (deliberate Phase 1 choice — see §3 N2).

Prefix table (MTN and Orange ranges, encoded as constants):

```js
const MTN_PREFIXES    = ['67', '650', '651', '652', '653', '654',
                         '680', '681', '682', '683', '684'];
const ORANGE_PREFIXES = ['69', '655', '656', '657', '658', '659',
                         '685', '686', '687', '688', '689'];
```

Lookup strips the `+237` country code, then matches longest-prefix-first.

Campay does **not** need this helper for collection (it auto-detects the operator from the phone). The helper exists purely to route **payouts** to the right MTN/Orange direct API.

### 5.3 `backend/src/services/payment/index.js` *(modified)*

Adds a `campay` block to the `config` object and a `case 'campay':` to `getProvider`. Throws at construction time if either `CAMPAY_APP_USERNAME` or `CAMPAY_APP_PASSWORD` is missing — fail loudly.

### 5.4 `backend/src/modules/groups/group.service.js` *(modified — extend existing)*

Add **two** service methods. Both follow the module's existing convention (use the imported `supabase` client directly):

```js
// Collection-gateway update. Same as the original design.
async updateGateway(groupId, gateway) {
  if (!['mtn_momo', 'orange_money', 'campay'].includes(gateway)) {
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

// Payout-gateway update. Accepts null to clear the column
// (falls back to phone-prefix routing).
async updatePayoutGateway(groupId, payoutGateway) {
  if (payoutGateway !== null &&
      !['mtn_momo', 'orange_money', 'campay'].includes(payoutGateway)) {
    const e = new Error('invalid payout gateway');
    e.statusCode = 400;
    throw e;
  }
  const { data, error } = await supabase
    .from('njangi_groups')
    .update({ preferred_payout_gateway: payoutGateway })
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

Controller wrappers are added to `group.controller.js`, and validation rules to `group.validation.js`, both following the existing patterns.

### 5.5 `backend/src/modules/groups/group.routes.js` *(modified — add two routes)*

```
PATCH /groups/:groupId/gateway
  ⨯ auth                          (existing)
  ⨯ tenant                        (existing — sets req.membership)
  ⨯ requireRole('president')      (existing — same pattern as PATCH /groups/:groupId)
  ⨯ body validation               ({ gateway: 'mtn_momo' | 'orange_money' | 'campay' })
  ⨯ updateGateway controller      → group.service.updateGateway(id, gateway)
  ⨯ auditService.log(groupId, callerUserId, 'GATEWAY_CHANGED',
                     { from: oldGateway, to: gateway })
  ⨯ 200 { ...group }

PATCH /groups/:groupId/payout-gateway
  ⨯ auth
  ⨯ tenant
  ⨯ requireRole('president')
  ⨯ body validation               ({ payout_gateway: 'mtn_momo' | 'orange_money'
                                                   | 'campay' | null })
  ⨯ updatePayoutGateway controller → group.service.updatePayoutGateway(id, payout_gateway)
  ⨯ auditService.log(groupId, callerUserId, 'PAYOUT_GATEWAY_CHANGED',
                     { from: oldPayoutGateway, to: payoutGateway })
  ⨯ 200 { ...group }
```

Full URLs: `PATCH /api/groups/:groupId/gateway` and `PATCH /api/groups/:groupId/payout-gateway`. Both guarded identically by `requireRole('president')` mirroring line 102 of the existing `group.routes.js`. Swagger annotations added inline in the same JSDoc style as surrounding routes.

**Why two endpoints instead of one with combined body?** Separation of concerns: each endpoint updates one column, validates one field, audits one event. A combined endpoint would need partial-update logic (which fields are present? do we no-op when both absent?) and a single audit event covering two possibly different changes. Two narrow endpoints are simpler to test, document via Swagger, and reason about.

### 5.6 `backend/src/engines/PayoutEngine.js` *(modified — constructor change + two-tier routing)*

The current constructor takes a single `paymentProvider` instance. To dispatch by group-configured rail OR phone prefix, that parameter is replaced with `paymentFactory`:

```js
// before:
constructor(contributionService, paymentProvider, notificationService, auditService, fineService)

// after:
constructor(contributionService, paymentFactory, notificationService, auditService, fineService)
```

Then inside `execute()`'s step 2, the **two-tier resolution** decides which provider's `disburse()` to call:

```js
// Tier 1: explicit group setting wins
let gateway = group.preferred_payout_gateway;

// Tier 2: fall back to phone-prefix routing (mtn_momo or orange_money)
if (!gateway) {
  gateway = phoneRouter.resolvePayoutGateway(recipient.phone);
}

const provider = this.paymentFactory.getProvider(gateway);
const result   = await provider.disburse(recipient.phone, payout.amount, payout.id);
```

This is a **breaking constructor change** — existing `PayoutEngine` instantiations and tests must be updated to pass `paymentFactory` instead of `paymentProvider`. The current implementation has step 2 stubbed (TODO comment), so the impact is limited to the test surface and any wiring code that constructs the engine.

**Eligibility check.** The existing `_checkWalletLinked` eligibility step already validates the recipient has a phone number. No new eligibility check is added for the gateway field — an admin who sets `preferred_payout_gateway = 'mtn_momo'` for an Orange-prefixed recipient gets a runtime error from the MTN API, which surfaces through the existing error path. We don't preemptively reject admin configurations that *might* fail.

### 5.7 Database migration *(new SQL file alongside `backend/src/config/schema.sql`)*

Adds **two** columns to `njangi_groups`:

```sql
ALTER TABLE njangi_groups
  ADD COLUMN preferred_gateway text NOT NULL DEFAULT 'mtn_momo'
    CHECK (preferred_gateway IN ('mtn_momo', 'orange_money', 'campay'));

ALTER TABLE njangi_groups
  ADD COLUMN preferred_payout_gateway text NULL
    CHECK (preferred_payout_gateway IS NULL
           OR preferred_payout_gateway IN ('mtn_momo', 'orange_money', 'campay'));
```

- **`preferred_gateway`** — collection rail. `NOT NULL`, default `'mtn_momo'`. Every existing group keeps using MTN MoMo direct for collection until an admin opts them into Campay or Orange.
- **`preferred_payout_gateway`** — payout rail. **Nullable.** `NULL` means "fall back to phone-prefix routing" — the existing behavior. Setting it to `'campay'` makes payouts go via `CampayService.disburse()`. Setting it to `'mtn_momo'` or `'orange_money'` is allowed but only sensible for single-operator groups.

Lives in `backend/src/config/migrations/2026-05-23-add-preferred-gateway.sql` (creating the folder if not present) and is also reflected in `schema.sql` for fresh setups.

### 5.8 `backend/.env.example` *(modified)*

```
# Campay credentials — get from https://campay.net dashboard after creating an app.
# CAMPAY_APP_USERNAME and CAMPAY_APP_PASSWORD are used to obtain a 1-hour JWT
# from POST /api/token/. CAMPAY_WEBHOOK_KEY is the separate webhook-signing key
# used to verify the JWT signature on inbound payment notifications.
CAMPAY_APP_USERNAME=
CAMPAY_APP_PASSWORD=
CAMPAY_WEBHOOK_KEY=

# Override only for production. Sandbox default is demo.campay.net.
CAMPAY_BASE_URL=https://demo.campay.net/api

# Public URL Campay will GET (or POST) payment notifications to. Configure the
# same URL + method in the Campay dashboard. Must be reachable from Campay's
# servers — use the Contabo VPS hostname for demo, or ngrok for local dev.
CAMPAY_NOTIFY_URL=https://your-naas-host.example.com/api/payments/campay/notify
```

Real values live in `backend/.env` (gitignored). `CAMPAY_APP_PASSWORD` and `CAMPAY_WEBHOOK_KEY` must never be logged, echoed, or returned in any API response.

### 5.9 `backend/src/services/payment/campaySignature.js` *(new — standalone module, ~30 lines)*

Pure module, no class state. Used by the webhook route without instantiating `CampayService`.

```js
const jwt = require('jsonwebtoken');

/**
 * Verify a Campay webhook signature.
 * Per Campay docs: the `signature` field on every webhook is a JWT signed
 * with the app's webhook key (HS256, matching the auth /token/ scheme).
 *
 * @param {string} signature   The `signature` field from the webhook payload
 * @param {string} webhookKey  Value of CAMPAY_WEBHOOK_KEY
 * @returns {object|null}      Decoded JWT payload if valid, null if invalid
 */
function verifyWebhookSignature(signature, webhookKey) {
  try {
    return jwt.verify(signature, webhookKey, { algorithms: ['HS256'] });
  } catch (_err) {
    return null;
  }
}

module.exports = { verifyWebhookSignature };
```

The `jsonwebtoken` package is already in the backend's dependency graph (used by `auth.middleware.js`). No new dependency needed.

### 5.10 `backend/src/modules/payments/` *(new module — webhook handling)*

A new minimal module for incoming payment webhooks. Standard module shape:

- `backend/src/modules/payments/payments.routes.js` — Express router.
- `backend/src/modules/payments/payments.controller.js` — webhook handler.
- `backend/src/modules/payments/payments.service.js` — idempotent ledger-update logic, shared between webhook and polling completion paths.

**Routes:**

```
GET  /api/payments/campay/notify
POST /api/payments/campay/notify
```

Per Campay docs: the integrator chooses GET or POST in the Campay dashboard. The route accepts both so the dashboard setting is not coupled to deployed code.

**Handler flow:**

```
1. Read params: req.query (GET) or req.body (POST), whichever contains 'reference'.
2. Extract `signature` from params.
3. campaySignature.verifyWebhookSignature(signature, env.CAMPAY_WEBHOOK_KEY)
       → object on success; null on failure.
   If null → respond 401 'invalid signature' and log warning. Return.
4. Extract: reference, external_reference, status, amount, currency, operator,
            code, operator_reference, endpoint, phone_number, reason.
5. Map Campay status → internal status:
       'SUCCESSFUL' → 'SUCCESSFUL'
       'FAILED'     → 'FAILED'
       (anything else) → 'FAILED' with a logged warning
6. paymentsService.applyTerminalStatus({
        paymentRef:   external_reference,   // contribution UUID
        externalRef:  reference,            // Campay's UUID
        status,
        rawPayload:   params,               // full webhook for audit
   })
7. Respond 200 'ok'.
```

**`paymentsService.applyTerminalStatus`** is the single idempotent write point used by both the webhook handler and the polling completion path:

- Loads the contribution row by `external_reference`.
- If the row is already in a terminal status, returns immediately — **no-op**.
- Otherwise updates `status`, `external_ref`, `paid_at` (or `failed_at`), and writes an audit log entry.

This is the linchpin of the dual-path completion model.

## 6. Data flow

### 6.1 Collection — `njangi_groups.preferred_gateway = 'campay'`

```
ContributionService.recordContribution(groupId, memberId, amount, contributionId)
        │
        ▼
  Look up njangi_groups.preferred_gateway = 'campay'
        │
        ▼
  factory.getProvider('campay') → CampayService
        │
        ▼
  CampayService.charge(phone='+237677000001', amount=5000, paymentRef=contributionId)
        │
        ├─ _normalizePhone → '237677000001'
        │
        ├─ _getToken (cache hit OR call POST /api/token/)
        │     POST /api/token/  { username, password }
        │      ← { token: '...', expires_in: 3600 }
        │     cache for ~55 min
        │
        ├─ POST /api/collect/
        │     Authorization: Token <jwt>
        │     { amount: '5000', currency: 'XAF', from: '237677000001',
        │       description: 'Njangi contribution',
        │       external_reference: contributionId }
        │   ← { reference: '<campay UUID>', ussd_code: '*126#', operator: 'mtn' }
        │
        └─ Poll every 2 s, max 30 s:
            GET /api/transaction/<reference>/
              ← { status: 'PENDING', ... }                       → keep polling
              ← { status: 'SUCCESSFUL', operator_reference, ... } → break
              ← { status: 'FAILED', reason, ... }                 → break
            (also short-circuits if the webhook already wrote the ledger)

  CampayService returns { success, externalRef: reference, status }
        │
        ▼
  ContributionService writes ledger via paymentsService.applyTerminalStatus
  (idempotent — webhook may have already done it)
```

**Idempotency.** `external_reference` is the NAAS contribution UUID. Campay dedupes server-side: a retry with the same `external_reference` returns the **original result**, not an error. No pre-flight ledger check needed (in contrast to Monetbil which rejected duplicates).

### 6.2 Payout — two-tier routing

```
PayoutEngine.execute(groupId, recipientId)
        │
        ▼
  checkEligibility(...)   → all 4 checks pass
        │
        ▼
  Load group.preferred_payout_gateway
        │
        ├─ IF column is set ───────────────────────────────────┐
        │     gateway = group.preferred_payout_gateway          │
        │     (one of 'mtn_momo' | 'orange_money' | 'campay')   │
        │                                                       │
        └─ ELSE (column is NULL — the default) ─────────────────┤
              gateway = phoneRouter.resolvePayoutGateway(       │
                          recipient.phone)                       │
              (always 'mtn_momo' or 'orange_money';              │
               throws .statusCode = 400 on unknown prefix)       │
                                                                 │
        ▼ ────────────────────────────────────────────────────── ┘
  provider = factory.getProvider(gateway)
        │       → MTNMoMoService | OrangeMoneyService | CampayService
        ▼
  provider.disburse(recipient.phone, payout.amount, payout.id)
        │
        ▼
  Update ledger → advance rotation → notify members
```

**Worked examples:**

- Group with `preferred_payout_gateway = NULL`, recipient phone `+23767...` → phone-prefix routing → `MTNMoMoService.disburse`.
- Group with `preferred_payout_gateway = NULL`, recipient phone `+23769...` → phone-prefix routing → `OrangeMoneyService.disburse`.
- Group with `preferred_payout_gateway = 'campay'`, any recipient → `CampayService.disburse` (Campay auto-detects the operator from the phone).
- Group with `preferred_payout_gateway = 'mtn_momo'`, recipient phone `+23769...` (Orange) → `MTNMoMoService.disburse` is called against an Orange number; MTN's API will likely reject; the existing error path surfaces the failure. Admin's responsibility to use this setting only for single-operator groups.

### 6.3 Admin endpoints — gateway and payout-gateway

**Collection gateway** — `PATCH /api/groups/:groupId/gateway`

```
PATCH /api/groups/:groupId/gateway
Authorization: Bearer <jwt>
Body: { "gateway": "campay" }

  ─ auth                          (existing middleware)
  ─ tenant                        (existing — populates req.membership)
  ─ requireRole('president')      (existing — same as PATCH /groups/:groupId)
  ─ body.gateway ∈ allowed set    (else 400)
  ─ group.service.updateGateway(groupId, gateway)
  ─ auditService.log(groupId, callerUserId, 'GATEWAY_CHANGED',
                     { from: oldGateway, to: gateway })
  ─ 200 { id, name, preferred_gateway, ... }
```

**Payout gateway** — `PATCH /api/groups/:groupId/payout-gateway`

```
PATCH /api/groups/:groupId/payout-gateway
Authorization: Bearer <jwt>
Body: { "payout_gateway": "campay" }    // or { "payout_gateway": null } to clear

  ─ auth
  ─ tenant
  ─ requireRole('president')
  ─ body.payout_gateway ∈ { 'mtn_momo', 'orange_money', 'campay', null }
  ─ group.service.updatePayoutGateway(groupId, payout_gateway)
  ─ auditService.log(groupId, callerUserId, 'PAYOUT_GATEWAY_CHANGED',
                     { from: oldPayoutGateway, to: payoutGateway })
  ─ 200 { id, name, preferred_payout_gateway, ... }
```

Sending `{ "payout_gateway": null }` clears the column and reverts the group to phone-prefix payout routing (the default behavior).

### 6.4 Webhook — `GET/POST /api/payments/campay/notify`

```
Campay → GET /api/payments/campay/notify
              ?status=SUCCESSFUL
              &reference=<campay uuid>
              &external_reference=<contribution uuid>
              &signature=<jwt>
              &amount=5000&currency=XAF&operator=MTN
              &code=ABC1234567890&operator_reference=1234567890
              &endpoint=collect&phone_number=237677000001
  (or POST with the same parameters as JSON body)
        │
        ▼
  Read params (req.query for GET, req.body for POST)
        │
        ▼
  campaySignature.verifyWebhookSignature(params.signature, CAMPAY_WEBHOOK_KEY)
        │     If invalid → 401, log, drop. (Defense against forged webhooks.)
        ▼
  Map status: 'SUCCESSFUL' / 'FAILED'  →  internal status
        │
        ▼
  paymentsService.applyTerminalStatus({ paymentRef, externalRef, status, rawPayload })
        │     If contribution row is already terminal → no-op.
        │     Otherwise → UPDATE contributions SET status, external_ref, paid_at, ...
        │                  + audit log.
        ▼
  200 'ok'
```

## 7. Error handling

Project convention: services throw errors with `.statusCode`; route handlers respond with `err.statusCode || 500`.

| Failure mode                                                       | Where                                | Behavior                                                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/token/` returns 4xx/5xx                                 | `CampayService._getToken`            | Throw `.statusCode = 502`. Token cache stays empty; next call retries.                                                    |
| `POST /api/collect/` returns 4xx                                   | `CampayService.charge`               | Throw `.statusCode = 502`, include Campay's error body in message.                                                        |
| `POST /api/collect/` returns 401                                   | `CampayService.charge`               | Clear token cache, retry once. If still 401 → throw `.statusCode = 502`.                                                  |
| Polling deadline reached (30 s, still PENDING)                     | `CampayService._pollStatus`          | Return `'TIMEOUT'`. `charge` returns `{ success: false, status: 'TIMEOUT', externalRef: reference }`. **Does not throw.** |
| `/transaction/` returns `status: FAILED`                           | `CampayService.charge`               | Map to `FAILED`. Return `{ success: false, ... }`. **Does not throw.**                                                    |
| Network / `fetch` rejects                                          | any method                           | Throw `.statusCode = 503` with `'Campay network error: ...'`.                                                             |
| `CampayService.refund()` invoked                                   | `CampayService.refund`               | Throw `Error('Campay does not support native refunds')`.                                                                  |
| `PATCH gateway` — invalid value                                    | Route validation                     | 400 `{ error: 'invalid gateway', allowed: [...] }`.                                                                       |
| `PATCH gateway` — caller not president                             | `requireRole('president')`           | 403 `{ error: 'only group president can change payment gateway' }`.                                                       |
| `PATCH gateway` — group not found                                  | `group.service.updateGateway`        | Throw `.statusCode = 404`.                                                                                                |
| `PATCH payout-gateway` — invalid value                             | Route validation                     | 400 `{ error: 'invalid payout gateway', allowed: ['mtn_momo','orange_money','campay',null] }`.                            |
| `PATCH payout-gateway` — caller not president                      | `requireRole('president')`           | 403.                                                                                                                      |
| `PATCH payout-gateway` — group not found                           | `group.service.updatePayoutGateway`  | Throw `.statusCode = 404`.                                                                                                |
| Payout — `preferred_payout_gateway='mtn_momo'` but recipient on Orange | `MTNMoMoService.disburse` (upstream) | MTN API rejects (4xx). Existing error path surfaces it as `.statusCode = 502` with the operator's message. Admin's misconfiguration. |
| Webhook — JWT signature invalid                                    | `payments.controller`                | 401 `'invalid signature'`, log warning. **Do not process the body.**                                                      |
| Webhook — unknown `external_reference`                             | `paymentsService.applyTerminalStatus`| Log warning (could be a webhook arriving before our DB insert is committed). Return 200 anyway so Campay doesn't retry.   |
| Webhook — contribution already terminal                            | `paymentsService.applyTerminalStatus`| No-op. Return 200. (Race with polling — expected.)                                                                        |
| Missing `CAMPAY_APP_USERNAME` / `CAMPAY_APP_PASSWORD` at first use | `factory.getProvider('campay')`      | Throw `.statusCode = 500` with `'CAMPAY_APP_USERNAME/PASSWORD is not configured'`. Fail loudly.                           |

**Logging.** All Campay-bound errors are logged via the existing audit/log path with `external_reference` and Campay's `reference` for cross-system correlation. Phone numbers are masked to last 3 digits. **`CAMPAY_APP_PASSWORD` and `CAMPAY_WEBHOOK_KEY` are never logged.**

**Retry policy.** None automatic in Phase 1. Campay's `external_reference` dedup makes manual retry safe; the webhook acts as eventual completion if polling timed out.

## 8. Testing

Unit tests are mock-first (London school); integration tests are skip-guarded against `backend/.env.test`.

### 8.1 Unit (no network, no DB)

**`backend/tests/unit/phoneRouter.test.js`** *(new)*
- Table-driven coverage of every MTN prefix and every Orange prefix.
- `null` for non-Cameroon prefixes (`+233...`), wrong length, non-numeric junk.
- `resolvePayoutGateway` returns `'mtn_momo'` / `'orange_money'`; throws `.statusCode = 400` on unrecognized prefix; never returns `'campay'`.

**`backend/tests/unit/campaySignature.test.js`** *(new)*
- `verifyWebhookSignature(<JWT signed with correct key>, correctKey)` → returns decoded payload.
- `verifyWebhookSignature(<JWT signed with wrong key>, correctKey)` → returns `null`.
- `verifyWebhookSignature('not-a-jwt', correctKey)` → returns `null`.
- `verifyWebhookSignature('', correctKey)` → returns `null`.

**Campay tests added to existing `backend/tests/unit/payment.service.test.js`** *(extend)*
- `CampayService extends PaymentProvider`.
- `charge` happy path: mock `fetch` to return token, then `/collect/` ref, then polling resolves to `SUCCESSFUL` → service returns `{ success: true, externalRef, status: 'SUCCESSFUL' }`. Assert `external_reference` in payload equals the passed `paymentRef`.
- `charge` failed path: polling returns `FAILED` → `{ success: false, status: 'FAILED' }`, no throw.
- `charge` timeout path: polling always returns `PENDING`; jest fake timers advance past 30 s → `{ success: false, status: 'TIMEOUT' }`, no throw.
- `charge` 401-then-success: first `/collect/` returns 401, service clears token + retries successfully → final result is success. Asserts `/token/` was called twice.
- `disburse` happy path: mock the same as charge but hitting `/withdraw/`. Asserts request body uses `to`, not `from`.
- `refund` throws regardless of input.
- `getStatus` returns mapped status from a single `/transaction/<ref>/` call.
- **Token cache:** call `charge` twice in succession with no clock advance — `/token/` should only be called once. Advance the clock past `expires_in - 5min` — `/token/` should be called again on the next operation.
- **Phone normalization:** `_normalizePhone('+237677000001')` → `'237677000001'`. Non-Cameroon → throws.

**Factory tests added to existing `backend/tests/unit/payment.service.test.js`** *(extend)*
- `getProvider('campay')` returns a `CampayService` instance when env is set.
- Throws when `CAMPAY_APP_USERNAME` or `CAMPAY_APP_PASSWORD` is unset.

**`backend/tests/unit/group.service.test.js`** *(extend)*
- `updateGateway('group-uuid', 'campay')` issues the correct Supabase update on `njangi_groups.preferred_gateway`; mock the `supabase` import.
- Invalid gateway value → throws `.statusCode = 400` before hitting Supabase.
- Group not found → throws `.statusCode = 404`.
- `updatePayoutGateway('group-uuid', 'campay')` updates `preferred_payout_gateway`.
- `updatePayoutGateway('group-uuid', null)` clears the column (sets it to null).
- `updatePayoutGateway` with an invalid string → `.statusCode = 400`.
- `updatePayoutGateway` on a non-existent group → `.statusCode = 404`.

**PayoutEngine tests** *(extend `backend/tests/unit/payout.service.test.js`)*
- Update constructor wiring across all existing PayoutEngine instantiations to pass `paymentFactory` instead of `paymentProvider`.
- **Two-tier routing matrix** — assert the exact provider call for each combination:
  - `preferred_payout_gateway = NULL`, MTN-prefix recipient → `MTNMoMoService.disburse`.
  - `preferred_payout_gateway = NULL`, Orange-prefix recipient → `OrangeMoneyService.disburse`.
  - `preferred_payout_gateway = NULL`, unrecognized prefix → `resolvePayoutGateway` throws `.statusCode = 400`; `disburse` never called.
  - `preferred_payout_gateway = 'campay'`, any recipient → `CampayService.disburse`.
  - `preferred_payout_gateway = 'mtn_momo'`, any recipient → `MTNMoMoService.disburse` (phone prefix ignored — admin's choice).
  - `preferred_payout_gateway = 'orange_money'`, any recipient → `OrangeMoneyService.disburse` (phone prefix ignored).
- Critical regression: when `preferred_payout_gateway = NULL` AND `preferred_gateway = 'campay'`, payouts must still go via phone-prefix routing (collection rail does NOT leak into payout rail).

**`backend/tests/unit/payments.service.test.js`** *(new — for the new module)*
- `applyTerminalStatus` updates a `PENDING` contribution to `SUCCESSFUL`; writes audit log.
- `applyTerminalStatus` on an already-terminal row is a no-op (no second update, no audit log).
- `applyTerminalStatus` on an unknown `paymentRef` logs a warning and returns without throwing.

### 8.2 Integration (skip-guarded — only run with `backend/.env.test`)

**Gateway endpoint tests added to existing `backend/tests/integration/group.api.test.js`** *(extend)*
- `PATCH /api/groups/:groupId/gateway` with president JWT → 200, `preferred_gateway` updated, `GATEWAY_CHANGED` audit log written.
- Same endpoint with non-president JWT → 403.
- Invalid `gateway` value → 400.
- Non-existent group ID → 404.
- `PATCH /api/groups/:groupId/payout-gateway` with president JWT and `{ "payout_gateway": "campay" }` → 200, column set, `PAYOUT_GATEWAY_CHANGED` audit log written.
- Same endpoint with `{ "payout_gateway": null }` → 200, column cleared.
- Non-president JWT → 403.
- Invalid `payout_gateway` value → 400.

**`backend/tests/integration/campay.webhook.integration.test.js`** *(new)*
- Valid GET with a JWT signed by the test key → 200; matching contribution row is updated.
- Valid POST with the same payload → 200; identical result.
- Invalid signature → 401; ledger unchanged.
- Already-terminal contribution → 200 (no-op); ledger unchanged.

### 8.3 Manual smoke test (pre-demo)

Add `docs/smoke-tests/campay.md` listing the manual steps:

1. Set real `CAMPAY_APP_USERNAME`, `CAMPAY_APP_PASSWORD`, `CAMPAY_WEBHOOK_KEY` in dev `.env`.
2. Configure the Campay dashboard callback URL to the Contabo VPS endpoint with method GET.
3. From a test group with `preferred_gateway = 'campay'`, trigger a contribution against a Campay sandbox test MSISDN.
4. Confirm the USSD/PIN prompt on the test phone; complete it.
5. Verify webhook arrived (server logs), ledger updated to `SUCCESSFUL`, audit log present.
6. Run polling separately: temporarily reconfigure the Campay dashboard callback URL to a black hole, trigger another payment, and verify polling completes the contribution within 30 s as a fallback.

### 8.4 Coverage and merge gate

- No new coverage threshold introduced — match the existing project bar.
- Per the branching rule, the feature branch only merges to main when `npm test` (from `backend/`) exits clean. No `.skip` shortcuts.

## 9. Out of scope (Phase 2 / future)

See §3 (Non-goals) for the full table. Headline items recapped:

- Card payments (Visa/Mastercard) — no Cameroon Momo aggregator processes cards; needs a different processor (Flutterwave/Paystack) or international expansion.
- Multi-country expansion.
- Automatic retries on `TIMEOUT`.
- Frontend "Payment settings" UI for the gateway-change endpoint.
- Campay JavaScript Widget (frontend SDK) integration.
- SaaS subscription billing for NAAS itself (Clerk Billing / Stripe).

## 10. References

- **Campay HTTP API docs** — https://documenter.getpostman.com/view/2391374/T1LV8PVA. Postman documenter; JS-rendered, so server-side fetch returns the page shell only. The endpoint sections (`/token/`, `/collect/`, `/transaction/<ref>/`, `/withdraw/`, webhook) used in this spec were extracted via direct paste during brainstorming.
- **Campay dashboard fields exposed during brainstorming:** `App ID`, `App Username`, `App Password`, `Permanent Access Token`, `App Webhook Key`, callback URL config with GET/POST method choice.
- **Abandoned alternative:** Monetbil design at commit `c0ce287`. Abandoned due to KYC/admin-approval onboarding timeline incompatible with the SEN2241 deadline. Useful for the report's literature-review chapter as a "considered, then rejected" provider with documented rationale.
- **Lecturer's grading rubric:** [SEN2241 final exam spec](../../requirements/SEN2241-final-exam-spec.md). Notes that ≥ 5 sequence diagrams are required — the Campay collection flow (§6.1), payout flow (§6.2), gateway-change endpoint (§6.3), and webhook (§6.4) each contribute one toward the requirement.
- **Existing implementations to mirror:**
  - [backend/src/services/payment/MTNMoMoService.js](../../../backend/src/services/payment/MTNMoMoService.js)
  - [backend/src/services/payment/OrangeMoneyService.js](../../../backend/src/services/payment/OrangeMoneyService.js)
  - [backend/src/services/payment/PaymentProvider.js](../../../backend/src/services/payment/PaymentProvider.js)
  - [backend/src/services/payment/index.js](../../../backend/src/services/payment/index.js)
  - [backend/src/engines/PayoutEngine.js](../../../backend/src/engines/PayoutEngine.js)
- **OOP demonstration target:** abstract base class + three concrete subclasses + a factory. Liskov substitution evidence: any code that holds a `PaymentProvider` reference works identically with all three implementations. With Campay, all four methods are real (`charge` / `disburse` / `getStatus` / `refund`), with `refund()` honestly declined as it is in MTN and Orange — strengthening the LSP story compared to Monetbil's `disburse`-throws subclass.

## 11. Open questions

None — all clarifying questions resolved during brainstorming:

- Gateway choice scope → per group, admin-set column. ✓
- Payout routing → **two-tier**: explicit `preferred_payout_gateway` column wins; phone-prefix fallback when null. ✓ *(updated from earlier "always phone-prefix" choice during second review.)*
- Cards in Phase 1 → no. ✓
- Stripe / Clerk Billing → no. ✓
- API endpoints for gateway change → two endpoints: `PATCH /api/groups/:groupId/gateway` and `PATCH /api/groups/:groupId/payout-gateway`. ✓
- Webhook + polling completion → both, with idempotent ledger update as the join point. ✓
- Signature module → standalone `campaySignature.js`, JWT-based. ✓
- Pivot from Monetbil → Campay confirmed and documented (§1, §10). ✓
- `preferred_payout_gateway` value space → `'mtn_momo' | 'orange_money' | 'campay' | NULL`; null is the default and means phone-prefix routing. ✓

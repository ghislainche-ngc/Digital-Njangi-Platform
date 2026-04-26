# Module: Contributions, Payouts & Scheduler

**Developer:** Dev B  
**Branch prefix:** `feature/dev-b/`  
**Modules owned:** `backend/src/modules/contributions/` · `payouts/` · `src/services/payment/` · `src/services/rotation/` · `src/engines/` · `src/jobs/`  
**Dependency:** Your work depends on Dev A's auth middleware and DB schema being merged first. If Dev A's schema isn't ready by Day 3, start your service skeletons with mock data and wire up the real DB later.

---

## Responsibilities Overview

You own the **money engine** — the most critical part of NAAS.
Every FCFA that moves through the system passes through your code.

| Area | What you build |
|------|---------------|
| PaymentProvider | Abstract class + MTN MoMo + Orange Money implementations |
| Contributions | MoMo deductions, cash recording, retries |
| Payout Engine | 5-step payout with 4 eligibility checks |
| Rotation Strategies | Fixed, Random, PresidentDecides |
| Scheduler | Monthly deductions, reminders, penalty detection |

---

## OOP Architecture (Exam Requirement)

```
PaymentProvider (abstract)          ← already scaffolded
├── MTNMoMoService                  ← your Task 1
└── OrangeMoneyService              ← your Task 1

RotationStrategy (abstract)         ← already scaffolded
├── FixedRotationStrategy           ← your Task 3
├── RandomDrawStrategy              ← your Task 3
└── PresidentDecisionStrategy       ← your Task 3

PayoutEngine                        ← your Task 4
└── execute(groupId, recipientId)   ← orchestrates all 5 steps
```

**The panel will ask you to open these files and explain each OOP pillar.**

---

## Week 1 — Task 1: PaymentProvider & MTN MoMo (Days 1–7)

**Branch:** `feature/dev-b/payment-provider`  
**Priority:** HIGH  
**Estimated time:** 8–10 hours

The abstract class and skeleton files are in `backend/src/services/payment/`.

**Implement in `MTNMoMoService.js`:**

MTN MoMo Sandbox base URL: `https://sandbox.momodeveloper.mtn.com`

**Collection flow (charge):**
1. `POST /collection/token/` with Basic Auth (`apiUser:apiKey` Base64) → Bearer token
2. `POST /collection/v1_0/requesttopay` — headers: `X-Reference-Id` (UUID), `X-Target-Environment: sandbox`, `Ocp-Apim-Subscription-Key`; body: `{ amount, currency: 'EUR', externalId, payer: { partyIdType: 'MSISDN', partyId: phone } }`
3. Poll `GET /collection/v1_0/requesttopay/{referenceId}` every 2 seconds until status ≠ `PENDING` or 30s timeout

**Register at:** [developer.mtn.com](https://developer.mtn.com) to get sandbox API user and key.

**Tests (`tests/unit/payment.service.test.js`):**
The arch tests are already written. Add:
- Mock `charge()` returns `{ success: true, externalRef: 'xyz' }`
- Failed charge returns `{ success: false, error: '...' }` (does NOT throw)

> If MTN registration is taking time, implement the real API later. The mock in tests is enough to unblock Dev B's payout engine.

---

## Week 2 — Task 2: Contribution Module (Days 8–14)

**Branch:** `feature/dev-b/contribution-module`  
**Estimated time:** 8–10 hours

Implement `ContributionService` in `backend/src/modules/contributions/contribution.service.js`.

**Key methods:**

```js
initiateMoMoDeduction(contributionId)
  // 1. Get contribution record + member phone
  // 2. Get payment provider: getProvider(member.gateway)
  // 3. provider.charge(phone, amount)
  // 4. Log in payment_transactions
  // 5. Update contribution status (confirmed / failed)
  // 6. If failed → retry ONCE automatically
  // 7. Trigger notification (success or failure)

recordCashPayment(groupId, memberId, recordedBy)
  // ANTI-FRAUD RULE — hardcoded, NEVER bypassable:
  // if (recordedBy === memberId) → FRAUD ALERT to President
  // Always log in audit_events
```

**Tests (`tests/unit/contribution.service.test.js`):**
- Successful charge → contribution marked confirmed
- Failed charge → retried once → if still fails, marked failed
- Cash payment by Treasurer for themselves → fraud alert fired
- Cash payment by Treasurer for another member → no fraud alert

---

### Task 3: Rotation Strategy Pattern (Days 8–14)

**Branch:** `feature/dev-b/rotation-strategies`  
**Estimated time:** 4–5 hours

Skeleton files are in `backend/src/services/rotation/`. Implement `selectNextRecipient()` in each strategy:

**FixedRotationStrategy:** `index = (cycleNumber - 1) % memberCount` → member at that rotation_position

**RandomDrawStrategy:** Filter out members who already received this cycle → random pick

**PresidentDecisionStrategy:** Return `null` (the PayoutEngine sees `null` and creates an `awaiting_nomination` record)

**Tests (`tests/unit/rotation.test.js`):**
All tests are already written. Run them — make them pass.

---

## Week 3 — Task 4: Payout Engine (Days 15–21)

**Branch:** `feature/dev-b/payout-engine`  
**Priority:** CRITICAL  
**Estimated time:** 10–12 hours

Implement `PayoutEngine.execute()` in `backend/src/engines/PayoutEngine.js`.

**The 5-step flow:**

1. **Eligibility** — run all 4 checks concurrently. If any fails, block and log.
2. **Disburse** — `paymentProvider.disburse(phone, amount)`
3. **Update ledger** — mark payout record `completed` with `externalRef`
4. **Advance rotation** — update cycle or prepare next cycle entry
5. **Notify all members** — `notificationService.sendBulk()` with `templates.payoutSent()`

**4 Eligibility checks (ALL must pass):**
1. `_checkPotCollected` — `payout_threshold_pct`% of contributions are confirmed
2. `_checkNoUnpaidFines` — recipient has no unpaid fines (calls `fineService.hasUnpaidFines`)
3. `_checkWalletLinked` — recipient has a non-null phone number
4. `_checkPresidentApproval` — if amount > `approval_threshold`, payout has `approved_by` set

**Tests (`tests/unit/payout.engine.test.js`):**
- All 4 checks pass → payout executes
- Pot not fully collected → blocked
- Unpaid fines → blocked
- No linked wallet → blocked
- No President approval for high amount → blocked

---

### Task 5: Automated Scheduler (Days 15–21)

**Branch:** `feature/dev-b/scheduler`  
**Estimated time:** 6–7 hours

Implement the three schedulers in `backend/src/jobs/`:

- `contributionScheduler.js` — runs 1st of each month, 8am WAT → trigger MoMo deductions for all active groups
- `reminderScheduler.js` — runs daily, 9am WAT → WhatsApp reminder 24h before payment day
- `penaltyScheduler.js` — runs daily, 10am WAT → apply daily fines for overdue contributions

**Tests (`tests/unit/scheduler.test.js`):**
- Use `jest.useFakeTimers()` and mock cron to trigger jobs
- Verify `ContributionService.initiateMoMoDeduction` called for each active group member

---

## Week 4 · Integration

1. Run full integration: scheduler → deduction → eligibility → payout
2. Fix bugs found by Dev D's test suite
3. Add JSDoc Swagger comments to all route files (Dev D will convert these to Swagger docs)
4. Verify all MoMo sandbox flows work end-to-end

---

## PR Template

```markdown
## What this PR does
[One sentence]

## APIs changed
- POST /groups/:groupId/contributions/cash
- GET /groups/:groupId/payouts

## MoMo sandbox tested
- [ ] Successful deduction flow
- [ ] Failed deduction + retry
- [ ] Successful payout disbursement

## Tests
- Unit: X passing
- Integration: X passing

## Checklist
- [ ] PaymentProvider abstraction used (no direct API calls in controller)
- [ ] All 4 eligibility checks implemented
- [ ] Fraud alert for Treasurer self-cash implemented
- [ ] Audit log entry for every financial action
- [ ] No secrets in code
```

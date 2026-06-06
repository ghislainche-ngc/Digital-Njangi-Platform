# Campay Manual Smoke Test (pre-demo)

> Run this before every panel demo, after any Campay-related code change,
> or whenever the Contabo VPS host or DNS changes.

## Prerequisites

- [ ] Backend deployed to the Contabo VPS with a public HTTPS hostname.
- [ ] `backend/.env` on the server has:
  - [ ] `APP_USERNAME` — from the Campay dashboard
  - [ ] `APP_PASSWORD` — from the Campay dashboard
  - [ ] `APP_WEBHOOK_KEY` — from the Campay dashboard
  - [ ] `CAMPAY_BASE_URL` — default `https://demo.campay.net/api` for sandbox
  - [ ] `CAMPAY_NOTIFY_URL` — `https://<contabo-host>/webhooks/campay`
- [ ] Campay dashboard: app callback URL is set to the same `CAMPAY_NOTIFY_URL`, method = POST.
- [ ] At least one test njangi group exists with `preferred_gateway = 'campay'`.
- [ ] At least one test member with a valid Campay sandbox MSISDN.

## Test 1 — collection happy path (webhook is primary)

1. Trigger a contribution from the test member.
2. Confirm the USSD/PIN prompt on the test phone; enter the PIN.
3. Within ~30 s:
   - [ ] Campay webhook arrived (check server logs for `[CampayWebhook]` lines).
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
   - [ ] `payouts` row updated to `status = 'completed'`.

## Test 4 — webhook signature rejection

1. Send a hand-crafted POST to `/webhooks/campay` with a bogus `X-Campay-Signature` header.
2. Server responds 401 (verify in server logs).

## Rollback

If anything looks wrong:
1. Set the group back to `preferred_gateway = 'mtn_momo'`.
2. Clear `preferred_payout_gateway` (set to NULL via the API).
3. Existing MTN/Orange direct rails take over.

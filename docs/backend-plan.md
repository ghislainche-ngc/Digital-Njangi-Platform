# NjangiBridge — Backend Implementation Plan

**Branch:** `backend`  
**Date:** 2026-04-17  
**Frontend reference:** `frontend` branch — 24 HTML pages, 5 role dashboards, all PR requirements mapped

---

## 1. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Runtime | **Node.js 20 LTS** | Stable, wide ecosystem, team familiarity |
| Framework | **Hono** (or Express 5) | Tiny footprint, edge-ready, TypeScript-first |
| Database | **Supabase (PostgreSQL 15)** | Row-Level Security, auth, real-time, hosted |
| Auth | **Supabase Auth** + custom JWT roles | Built-in OTP/email, we add Njangi role claims |
| MoMo | **MTN MoMo API** + **Orange Money API** | PR-13, PR-20 — both channels already in UI |
| Notifications | **Telegram Bot API** + **Africa's Talking SMS** | Replaces WhatsApp; SMS fallback (UN-07, UR-28) |
| PDF receipts | **pdf-lib** or **Puppeteer** | PR-19, PR-29, PR-35 |
| Scheduler | **pg_cron** (Supabase) + **node-cron** | Auto-debit on cycle day, reminders D-3/D-1 |
| File storage | **Supabase Storage** | Meeting minutes PDFs, receipts |
| Deployment | **Railway** or **Render** (Node) + Supabase cloud | Low ops overhead |

---

## 2. Project Structure

```
/                          ← repo root (same repo as frontend)
├── backend/
│   ├── src/
│   │   ├── index.ts          ← Hono app entry, middleware registration
│   │   ├── config/
│   │   │   └── env.ts        ← zod-validated env schema
│   │   ├── db/
│   │   │   ├── client.ts     ← Supabase admin client
│   │   │   └── migrations/   ← SQL migration files (001_init.sql …)
│   │   ├── modules/
│   │   │   ├── auth/         ← login, register, OTP, role-redirect
│   │   │   ├── groups/       ← group CRUD (admin)
│   │   │   ├── members/      ← invite, assign role, remove
│   │   │   ├── contributions/← auto-debit, manual cash, retry
│   │   │   ├── payouts/      ← eligibility, trigger, history
│   │   │   ├── fines/        ← issue, mark paid, waive
│   │   │   ├── social-fund/  ← deposit, withdraw, balance
│   │   │   ├── rotation/     ← schedule, current position
│   │   │   ├── ledger/       ← immutable append-only log
│   │   │   ├── receipts/     ← PDF generation, storage links
│   │   │   ├── announcements/← create, list, dispatch to Telegram/SMS
│   │   │   ├── minutes/      ← create, publish, PDF upload
│   │   │   ├── notifications/← Telegram bot + SMS adapter
│   │   │   └── analytics/    ← admin KPIs
│   │   ├── middleware/
│   │   │   ├── auth.ts       ← JWT verify + role guard
│   │   │   ├── rls.ts        ← set Supabase RLS context per request
│   │   │   └── validate.ts   ← zod request body validation
│   │   └── jobs/
│   │       ├── auto-debit.ts ← run on cycle day
│   │       ├── reminders.ts  ← D-3, D-1 Telegram/SMS nudges
│   │       └── retry.ts      ← retry failed MoMo debits (PR-16)
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
└── (frontend files at root level)
```

---

## 3. Database Schema

Derived directly from the frontend mock data and PRS requirements.

### 3.1 Core tables

```sql
-- Multi-tenant root
CREATE TABLE groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  plan        text NOT NULL DEFAULT 'starter', -- starter|growth|pro|enterprise
  status      text NOT NULL DEFAULT 'trial',   -- trial|active|suspended
  created_at  timestamptz DEFAULT now()
);

-- Users (extends Supabase auth.users)
CREATE TABLE members (
  id          uuid PRIMARY KEY REFERENCES auth.users(id),
  group_id    uuid REFERENCES groups(id) ON DELETE CASCADE,
  full_name   text NOT NULL,
  phone       text NOT NULL,                  -- MoMo number
  email       text,
  role        text NOT NULL DEFAULT 'member', -- admin|president|treasurer|secretary|member
  mtn_verified   boolean DEFAULT false,
  orange_verified boolean DEFAULT false,
  telegram_chat_id text,
  created_at  timestamptz DEFAULT now()
);

-- Njangi cycle configuration (locked once cycle starts — PR-09)
CREATE TABLE cycles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid REFERENCES groups(id),
  cycle_number    int NOT NULL,
  amount_fcfa     int NOT NULL,               -- contribution per member
  social_fcfa     int NOT NULL DEFAULT 1000,  -- social fund slice
  frequency       text NOT NULL DEFAULT 'monthly',
  rotation_type   text NOT NULL DEFAULT 'random', -- fixed|random|president
  due_day         int NOT NULL DEFAULT 14,    -- day-of-month
  payout_day      int NOT NULL DEFAULT 28,
  started_at      timestamptz,
  ended_at        timestamptz
);

-- Rotation order (PR-23/24/25)
CREATE TABLE rotation_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id    uuid REFERENCES cycles(id),
  position    int NOT NULL,
  member_id   uuid REFERENCES members(id),
  payout_date date,
  paid_out_at timestamptz,
  UNIQUE (cycle_id, position)
);
```

### 3.2 Ledger (immutable — PR-34)

```sql
-- Every financial event is INSERT-only. No UPDATE, no DELETE.
CREATE TABLE ledger_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid REFERENCES groups(id),
  cycle_id    uuid REFERENCES cycles(id),
  type        text NOT NULL, -- contribution|payout|fine|fine_waiver|social_deposit|social_withdrawal|correction
  member_id   uuid REFERENCES members(id),
  amount_fcfa int NOT NULL,
  direction   text NOT NULL DEFAULT 'credit', -- credit|debit
  method      text,          -- mtn_momo|orange_money|cash|bank_transfer
  status      text NOT NULL DEFAULT 'pending', -- pending|paid|failed|sent|waived
  reference   text,          -- MoMo transaction reference
  notes       text,          -- waiver reason, correction note
  receipt_url text,          -- Supabase Storage URL
  created_at  timestamptz DEFAULT now(),
  created_by  uuid REFERENCES members(id)     -- audit trail
);

-- RLS: every member of the group can SELECT; only treasurer/system can INSERT
```

### 3.3 Fines (PR-36/37/38)

```sql
CREATE TABLE fines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id   uuid REFERENCES ledger_entries(id), -- immutable log entry
  group_id    uuid REFERENCES groups(id),
  member_id   uuid REFERENCES members(id),
  reason      text NOT NULL,
  amount_fcfa int NOT NULL,
  status      text NOT NULL DEFAULT 'unpaid', -- unpaid|paid|waived
  waive_reason text,
  issued_at   timestamptz DEFAULT now(),
  resolved_at timestamptz
);
```

### 3.4 Social fund (PR-39)

```sql
CREATE TABLE social_fund_rules (
  group_id          uuid PRIMARY KEY REFERENCES groups(id),
  per_cycle_fcfa    int NOT NULL DEFAULT 1000,
  approval_threshold int NOT NULL DEFAULT 10000
);
-- Transactions tracked via ledger_entries (type = social_deposit | social_withdrawal)
```

### 3.5 Announcements & Minutes (PR-10/11)

```sql
CREATE TABLE announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid REFERENCES groups(id),
  author_id   uuid REFERENCES members(id),
  title       text NOT NULL,
  body        text NOT NULL,
  channels    text[] NOT NULL DEFAULT '{telegram}', -- telegram|sms|in_app
  sent_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE minutes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid REFERENCES groups(id),
  author_id   uuid REFERENCES members(id),
  title       text NOT NULL,
  date        date NOT NULL,
  attendee_count int,
  status      text NOT NULL DEFAULT 'draft', -- draft|published
  file_url    text,           -- Supabase Storage
  published_at timestamptz,
  created_at  timestamptz DEFAULT now()
);
```

### 3.6 MoMo jobs (PR-13/16)

```sql
CREATE TABLE momo_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id     uuid REFERENCES ledger_entries(id),
  provider      text NOT NULL, -- mtn|orange
  phone         text NOT NULL,
  amount_fcfa   int NOT NULL,
  status        text NOT NULL DEFAULT 'pending', -- pending|success|failed|retrying
  attempts      int NOT NULL DEFAULT 0,
  last_error    text,
  next_retry_at timestamptz,
  created_at    timestamptz DEFAULT now()
);
```

---

## 4. API Routes

All routes are prefixed `/api/v1`. JWT required on all except `/auth/*`.

### 4.1 Auth (`/api/v1/auth`)

| Method | Path | Who | Frontend trigger |
|---|---|---|---|
| POST | `/register` | public | register.html → "Create Njangi" |
| POST | `/login` | public | login.html → "Log in" |
| POST | `/otp/send` | public | login.html → "Use one-time code" |
| POST | `/otp/verify` | public | OTP input |
| POST | `/logout` | any | all dashboards → "Log out" |
| GET | `/me` | any | boot.js session restore |

**Register flow (PR-01, PR-02, PR-04):**
1. Create Supabase auth user
2. Create `groups` row + `members` row (role = `president`)
3. Create initial `cycles` row with provided settings
4. Return JWT with custom claims: `{ role, group_id }`
5. Frontend `role-redirect.js` sends to `/app/president/`

### 4.2 Members (`/api/v1/members`)

| Method | Path | Who | PRS |
|---|---|---|---|
| GET | `/` | president, secretary, treasurer | PR-06 |
| POST | `/invite` | president | PR-06 |
| PATCH | `/:id/role` | president | PR-06 |
| DELETE | `/:id` | president | PR-07 |
| PATCH | `/:id/wallet` | member (self) | PR-20 |
| GET | `/:id/profile` | member (self) | PR-33 |
| PATCH | `/:id/profile` | member (self) | profile page |

### 4.3 Contributions (`/api/v1/contributions`)

| Method | Path | Who | PRS |
|---|---|---|---|
| GET | `/` | treasurer, president | PR-13 |
| POST | `/debit` | scheduler (system) | PR-13 auto MoMo debit |
| POST | `/cash` | treasurer | PR-18 manual cash record |
| POST | `/:id/retry` | treasurer / scheduler | PR-16 retry |
| GET | `/history` | member (own) | PR-33 |

### 4.4 Payouts (`/api/v1/payouts`)

| Method | Path | Who | PRS |
|---|---|---|---|
| GET | `/next` | treasurer, president | PR-21 |
| POST | `/trigger` | treasurer (president approved) | PR-21, PR-26 |
| GET | `/history` | all members | PR-32 |
| POST | `/:id/approve` | president | PR-21 threshold check |

**Eligibility checklist (PR-21, PR-30):**
- Pot reached threshold ✓
- No unpaid fines ✓
- MoMo wallet verified ✓
- Not paying out to self if actor is treasurer ✓ (fraud alert)

### 4.5 Fines (`/api/v1/fines`)

| Method | Path | Who | PRS |
|---|---|---|---|
| GET | `/` | treasurer, president | PR-36 |
| POST | `/` | treasurer | PR-36 issue |
| PATCH | `/:id/paid` | treasurer | PR-37 |
| PATCH | `/:id/waive` | treasurer | PR-38 (requires reason) |

### 4.6 Social Fund (`/api/v1/social-fund`)

| Method | Path | Who | PRS |
|---|---|---|---|
| GET | `/` | all members | PR-39 |
| POST | `/deposit` | treasurer / scheduler | PR-39 |
| POST | `/withdraw` | treasurer (president approved if > threshold) | PR-39 |

### 4.7 Rotation (`/api/v1/rotation`)

| Method | Path | Who | PRS |
|---|---|---|---|
| GET | `/` | all members | PR-23 |
| GET | `/my` | member (self) | PR-24 |
| POST | `/draw` | system (scheduler) | PR-25 random draw |
| PATCH | `/assign` | president | PR-25 president-nominated |

### 4.8 Ledger (`/api/v1/ledger`)

| Method | Path | Who | PRS |
|---|---|---|---|
| GET | `/` | all members of group | PR-31 |
| GET | `/my` | member (own entries only) | PR-33 |

No POST/PATCH/DELETE — ledger is INSERT-only at the DB level via a trigger.

### 4.9 Announcements (`/api/v1/announcements`)

| Method | Path | Who | PRS |
|---|---|---|---|
| GET | `/` | all members | PR-10 |
| POST | `/` | secretary | PR-10 |

On POST: dispatch to Telegram Bot API + Africa's Talking SMS based on `channels[]`.

### 4.10 Minutes (`/api/v1/minutes`)

| Method | Path | Who | PRS |
|---|---|---|---|
| GET | `/` | all members | PR-11 |
| POST | `/` | secretary | PR-11 |
| PATCH | `/:id/publish` | secretary | PR-11 |
| GET | `/:id/pdf` | all members | PR-11 |

### 4.11 Receipts (`/api/v1/receipts`)

| Method | Path | Who | PRS |
|---|---|---|---|
| GET | `/:ledger_id` | member (own) | PR-19, PR-29 |

Generates PDF on-the-fly with pdf-lib, caches to Supabase Storage.

### 4.12 Admin (`/api/v1/admin`)

| Method | Path | Who | PRS |
|---|---|---|---|
| GET | `/groups` | platform admin | PR-40 |
| PATCH | `/groups/:id/suspend` | platform admin | PR-41 |
| GET | `/analytics` | platform admin | PR-42 |

---

## 5. Authentication & Role Guards

```
JWT claim: { sub: member_id, group_id, role: 'admin|president|treasurer|secretary|member' }

Role hierarchy:
  admin       → all routes
  president   → group-scoped: read everything, write members/settings/approve payouts
  treasurer   → group-scoped: write contributions/payouts/fines/social-fund
  secretary   → group-scoped: write announcements/minutes/directory
  member      → group-scoped: read own history/rotation/ledger; write own profile
```

Supabase RLS policies mirror the same hierarchy so even direct DB calls respect role boundaries.

---

## 6. MoMo Integration (PR-13, PR-16, PR-18, PR-20)

### MTN MoMo Collections API
```
POST /collection/v1_0/requesttopay
  X-Reference-Id: <uuid>
  Body: { amount, currency: "XAF", externalId, payer: { partyIdType: "MSISDN", partyId: phone } }

Webhook → PATCH /api/v1/webhooks/mtn  → update momo_jobs + ledger_entries
```

### Retry logic (PR-16)
- Max 3 attempts, backoff: 4h → 24h → 48h
- After 3 failures: status = `failed`, treasurer notified, fine auto-generated

### Orange Money
- Same pattern via Orange Money API (sandbox → production)
- Detected by phone prefix: `6[57]XXXXXXX` = Orange

---

## 7. Telegram Bot Integration

### Bot setup
- Register `@NjangiBridgeBot` via BotFather
- Deep link for account connect: `https://t.me/NjangiBridgeBot?start=<member_token>`
- Webhook endpoint: `POST /api/v1/webhooks/telegram`

### Notification triggers

| Event | Message | PRS |
|---|---|---|
| D-3 before due | "Reminder: your Njangi contribution of X FCFA is due in 3 days." | UR-03 |
| D-0 confirmation | "✓ Contribution received. Ref: XXXXX" | PR-14 |
| Payment failed | "⚠ Your MoMo payment failed. We'll retry in 4h." | PR-15 |
| Payout sent | "💰 [Name] has received the pot — X FCFA via MoMo." | PR-27 |
| Fine issued | "Fine of X FCFA issued: [reason]." | PR-36 |
| New announcement | Secretary message text | PR-10 |

SMS via Africa's Talking fires as fallback when `telegram_chat_id` is null (UN-07).

---

## 8. Scheduler Jobs

| Job | Trigger | Action |
|---|---|---|
| `auto-debit` | pg_cron: `cycle.due_day` at 08:00 | Create `momo_jobs` for every member, fire MoMo Collections |
| `retry-failed` | every 4h | Re-attempt `momo_jobs` where status=failed AND attempts < 3 |
| `reminder-d3` | 3 days before `cycle.due_day` | Telegram/SMS nudge to unpaid members |
| `reminder-d1` | 1 day before | Same, urgency tone |
| `rotation-draw` | day before `cycle.payout_day` | If rotation_type=random, draw next slot |
| `social-collect` | same as `auto-debit` | Append social fund slice to each debit |

---

## 9. PDF Receipts (PR-19, PR-29, PR-35)

Generated with **pdf-lib**, stored in `supabase.storage` bucket `receipts/`:

- **Contribution receipt** — member name, date, amount, MoMo ref, group name, NjangiBridge logo
- **Payout receipt** — same fields + rotation position, delivery method
- **Group financial report** — president/reports.html export: all cycles, totals, chart data

URL pattern: `receipts/{group_id}/{cycle_id}/{ledger_entry_id}.pdf`

---

## 10. Implementation Phases

### Phase 1 — Core (Sprint 2–3)
- [ ] Supabase project setup + schema migrations (tables above)
- [ ] RLS policies for all 5 roles
- [ ] `POST /auth/register` — group + president creation
- [ ] `POST /auth/login` + JWT role claims
- [ ] `GET /members`, `PATCH /members/:id/role` (president)
- [ ] `POST /contributions/debit` — MTN MoMo sandbox call
- [ ] `GET /ledger` — read-only, all group members
- [ ] `GET /rotation` — current schedule
- [ ] Frontend swap: replace `mocks/` JSON with real `/api/v1` calls in `src/js/api/client.js`

### Phase 2 — Payments & Payout (Sprint 4)
- [ ] MoMo webhook handler + ledger write
- [ ] Retry scheduler
- [ ] `POST /payouts/trigger` with eligibility gate
- [ ] `POST /payouts/:id/approve` (president threshold)
- [ ] Payout notification broadcast (Telegram + SMS)

### Phase 3 — Officer tools (Sprint 5)
- [ ] Fines CRUD + waiver logging
- [ ] Social fund deposit/withdraw
- [ ] Announcements → Telegram/SMS dispatch
- [ ] Minutes upload to Supabase Storage
- [ ] PDF receipts for contributions + payouts

### Phase 4 — Admin & Reports (Sprint 6)
- [ ] Platform admin routes (groups, suspend, analytics)
- [ ] `GET /receipts/:id` PDF generation
- [ ] `GET /admin/analytics` — active groups, MoMo volume, churn, payout success
- [ ] Scheduler jobs in production (pg_cron)
- [ ] Telegram bot deep-link connect flow
- [ ] Orange Money integration (second payment channel)

---

## 11. Environment Variables

```env
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=

# MoMo
MTN_MOMO_BASE_URL=https://sandbox.momodeveloper.mtn.com
MTN_MOMO_SUBSCRIPTION_KEY=
MTN_MOMO_API_USER=
MTN_MOMO_API_KEY=
ORANGE_MONEY_BASE_URL=
ORANGE_MONEY_CLIENT_ID=
ORANGE_MONEY_SECRET=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

# SMS
AFRICASTALKING_API_KEY=
AFRICASTALKING_USERNAME=
AFRICASTALKING_SENDER_ID=NjangiBridge

# App
API_BASE_URL=https://api.njangibridge.cm
JWT_SECRET=
NODE_ENV=development
PORT=3000
```

---

## 12. Contract with the Frontend

The frontend `src/js/api/client.js` already reads `VITE_API_BASE_URL` and attaches the JWT header. The only change needed to go live is:

1. Set `VITE_API_BASE_URL=https://api.njangibridge.cm` in `.env`
2. Replace the `mocks/` stubs with real responses that match the shapes already expected by each page
3. Swap `localStorage` JWT storage to httpOnly cookie (done in `session.js` as a one-liner flag)

All page logic stays identical — the backend is a pure data/auth contract, not a new UI.

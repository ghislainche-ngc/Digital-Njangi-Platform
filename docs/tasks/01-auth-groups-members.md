# Module: Authentication, Groups & Members

**Developer:** Dev A  
**Branch prefix:** `feature/dev-a/`  
**Modules owned:** `backend/src/modules/auth/` · `groups/` · `members/` · `src/middleware/`  
**Critical path:** Your auth middleware and DB schema are needed by **every other developer**. Complete Tasks 1 and 2 by end of Week 1.

---

## Responsibilities Overview

| Area | What you build |
|------|---------------|
| Auth | Register, login, OTP verification, JWT issuance |
| Middleware | JWT verification, tenant resolution, role checks |
| Groups | Create group, get details, update settings |
| Members | Invite, accept invite, assign roles, remove member |
| Config | Supabase client setup, env validation, DB schema |

---

## Week 1 — Tasks 1 & 2 (Days 1–7)

### Task 1 · Project Bootstrap & Supabase Config
**Branch:** `feature/dev-a/project-bootstrap`  
**Priority:** CRITICAL — blocks all other developers  
**Estimated time:** 4–6 hours

1. Create `backend/src/config/supabase.js` — Supabase client with env validation
2. Create `backend/src/config/env.js` — validate all required env vars on startup (throw clearly if any missing)
3. Verify `backend/src/app.js` works: `GET /health → 200 { status: 'ok' }`
4. Write `backend/tests/unit/config.test.js` — verify env validation throws on missing vars

**Done when:**
- `GET /health` returns `{ status: 'ok', timestamp: '...' }` with 200
- App exits with a clear error message if `.env` is incomplete
- `npm test` passes

---

### Task 2 · Database Schema
**Branch:** `feature/dev-a/database-schema`  
**Priority:** CRITICAL  
**Estimated time:** 6–8 hours

The full schema is already scaffolded in `backend/src/config/schema.sql`. Your job:

1. Open your Supabase project → **SQL Editor**
2. Run `schema.sql` — verify all tables are created
3. Run `rls-policies.sql` — verify RLS is enabled on all tables
4. Add the `password_hash TEXT` column to the `users` table (the schema has it as a comment — you need to add it)
5. Test RLS isolation: create two groups, verify user from Group A cannot query Group B's data
6. Write `backend/tests/integration/rls.test.js` (see template in `docs/tasks/04-testing-documentation.md`)

**Done when:**
- All 11 tables exist in Supabase
- RLS is enabled on all tables with correct policies
- Integration test proves tenant isolation

---

### Task 3 · Auth Module — Register & OTP
**Branch:** `feature/dev-a/auth-register`  
**Estimated time:** 6–8 hours

The skeleton is in `backend/src/modules/auth/`. Implement these methods in `auth.service.js`:

**Endpoints:**

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/auth/register` | Create user + trigger OTP |
| `POST` | `/auth/verify-otp` | Verify OTP → return JWT |
| `POST` | `/auth/login` | Email + password → JWT |

**OTP:** If Supabase SMS isn't available, generate a 6-digit code, store in an `otp_verifications` table with 10-minute expiry, send via SMS/Telegram.

**JWT payload must include:**
```json
{ "sub": "user-uuid", "email": "user@email.com" }
```

**Tests to write (`tests/unit/auth.service.test.js`):**
- Register with valid data → user created (201)
- Register with duplicate email → 409
- Login with wrong password → 401
- OTP expired → 400
- OTP correct → JWT returned

---

### Task 4 · JWT & Tenant Middleware
**Branch:** `feature/dev-a/middleware`  
**Estimated time:** 4–5 hours

The skeleton is in `backend/src/middleware/`. Complete all four middleware files.

The `auth.middleware.js` and `role.middleware.js` skeletons are fully implemented. You need to complete:

**`tenant.middleware.js`:**
- Read `group_id` from `req.params.groupId`
- Query Supabase to verify `req.user.sub` is an active member of that group
- Attach `req.group` and `req.membership` for downstream handlers

**Tests (`tests/unit/middleware.test.js`):**
- The skeleton test file already exists with arch tests. Add:
  - Tenant middleware — user not in group → 403
  - Tenant middleware — user in group → next() called, req.group populated

---

## Week 2 — Tasks 5 & 6 (Days 8–14)

### Task 5 · Group Module
**Branch:** `feature/dev-a/group-module`  
**Estimated time:** 5–6 hours

Implement `group.service.js`. The routes file is scaffolded.

**`GroupService` methods to implement:**

```js
createGroup(userId, groupData)
  // 1. Insert into njangi_groups (created_by = userId)
  // 2. Insert membership: { role: 'president', rotation_position: 1 }
  // 3. Create first cycle: { cycle_number: 1, start_date: today }
  // Returns: { group, membership, cycle }

getGroup(groupId)
  // Return group with member count and current active cycle

updateSettings(groupId, data)
  // BLOCK: cannot change rotation_type mid-cycle → throw 400
```

**Tests (`tests/unit/group.service.test.js`):**
- Create group → creator becomes president
- Update rotation type mid-cycle → throws error
- Ledger returns entries in chronological order

---

### Task 6 · Member Module
**Branch:** `feature/dev-a/member-module`  
**Estimated time:** 5–6 hours

Implement `member.service.js`. The routes file is scaffolded.

**Business rules:**
- Removed member gets logged in `audit_events` (use `AuditService` from `services/audit/`)
- Cannot remove yourself if you are President — must transfer role first
- Cannot invite someone already in the group
- Invite tokens expire after 7 days

**Tests (`tests/unit/member.service.test.js`):**
- Invite → token created → accepted → membership created
- Expired token → 400
- President removes member → audit event logged
- President tries to remove self → error thrown

---

## Weeks 3–4 · Support & Integration

1. Review Dev B's and Dev C's PRs within 24 hours
2. Fix any bugs found in your modules during integration testing
3. Help integrate the frontend login/register/group-creation pages with your API
4. Write integration tests for the full auth flow end-to-end

---

## PR Template

```markdown
## What this PR does
[One clear sentence]

## Endpoints added / changed
- POST /auth/register
- POST /auth/verify-otp

## How to test
1. Run `npm test`
2. Use `tests/http/auth.http` to call manually
3. Expected response: { token: '...' }

## Checklist
- [ ] Tests written and passing
- [ ] No secrets in code
- [ ] ESLint clean
- [ ] Business logic in service, not controller
```

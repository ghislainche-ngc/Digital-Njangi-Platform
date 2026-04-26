# Contributing to NjangiBridge (NAAS)

Welcome to the team. This guide is your reference for how we work together.
Read it once before you write your first line of code. It will save you hours.

---

## 1 · Project Overview

NAAS is a multi-tenant SaaS platform for Njangi rotating-savings groups. The backend is Node.js + Express + Supabase. The frontend is HTML + Tailwind CSS (PWA). See `README.md` for the full tech stack.

**Presentation deadline:** 1st week of June 2026.

---

## 2 · Getting Started

```bash
# 1. Clone
git clone https://github.com/ghislainche-ngc/Digital-Njangi-Platform.git
cd Digital-Njangi-Platform

# 2. Create your feature branch (NEVER work on main directly)
git checkout main
git pull origin main
git checkout -b feature/dev-a/auth-register   # use your own prefix

# 3. Install backend dependencies
cd backend
npm install
cp .env.example .env
# Ask the CTO for Supabase credentials

# 4. Run tests to confirm your environment works
npm test
```

---

## 3 · Branch Naming Rules

```
feature/dev-a/auth-register
feature/dev-b/contribution-scheduler
feature/dev-c/whatsapp-notifications
fix/dev-a/login-otp-bug
```

**Pattern:** `{type}/{dev-prefix}/{short-description}`
- Types: `feature`, `fix`, `test`, `docs`
- Dev prefixes: `dev-a`, `dev-b`, `dev-c`, `dev-d`
- Description: lowercase, hyphens, no spaces

---

## 4 · Commit Message Rules

```
✅  feat: add JWT middleware with tenant injection
✅  fix: retry MoMo deduction on Orange number failures
✅  test: add unit tests for RotationEngine strategy pattern
✅  docs: add Swagger annotations to /auth routes

❌  fix
❌  update
❌  wip
❌  aaa
```

**Format:** `type: short description (50 chars max)`
Types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`

---

## 5 · PR Rules

Every feature = its own branch = its own PR.

**Before opening a PR:**
- [ ] `npm test` passes locally (all tests green)
- [ ] `npm run lint` passes (no ESLint errors)
- [ ] No secrets, API keys, or passwords in the code
- [ ] Business logic is in the service class, NOT in the controller
- [ ] Your feature has at least one unit test

**PR title format:** `[Dev A] Add JWT auth middleware`

**PR description must include:**
1. One-sentence description of what this PR does
2. Endpoints added or changed (if applicable)
3. How to test it manually (or which test to run)
4. Checklist (see task files for module-specific checklists)

---

## 6 · Code Review Etiquette

- **Reviewer response time:** within 24 hours
- **Author response time:** address review comments within 24 hours
- Leave constructive comments, not just "wrong" — explain why and suggest the fix
- If you disagree with feedback, discuss it in the PR comments or WhatsApp — don't silently ignore it
- The CTO has final merge authority

---

## 7 · File Organization

```
backend/
├── src/
│   ├── app.js             # Express app — DO NOT put business logic here
│   ├── config/            # DB client, env validation, SQL files
│   ├── middleware/        # Auth, tenant, role, error handlers
│   ├── modules/           # Feature modules — one folder per domain
│   │   └── {module}/
│   │       ├── {module}.routes.js      # Express router + Swagger JSDoc
│   │       ├── {module}.controller.js  # Request handling only (thin)
│   │       ├── {module}.service.js     # All business logic lives here
│   │       └── {module}.validation.js  # Joi schemas
│   ├── services/          # Shared cross-module services
│   └── jobs/              # Cron schedulers
└── tests/
    ├── unit/              # Jest unit tests (mock DB, no real API calls)
    ├── integration/       # Supertest integration tests (real Supabase test DB)
    ├── security/          # RLS isolation tests
    ├── http/              # .http files for manual testing
    └── helpers/           # Shared test utilities
```

---

## 8 · OOP Rules (Exam Requirement)

The panel will examine your code for OOP pillars. Every module must use:

| Pillar | How we implement it |
|--------|---------------------|
| **Encapsulation** | Business logic in service classes, never in controllers or routes |
| **Abstraction** | `PaymentProvider`, `NotificationService`, `RotationStrategy` abstract base classes |
| **Inheritance** | `MTNMoMoService extends PaymentProvider`, `TelegramNotificationService extends NotificationService` |
| **Polymorphism** | `getProvider('mtn_momo')` and `getProvider('orange_money')` return different classes with identical interfaces |

**Never** call a third-party API directly from a controller. Always go through an abstract service class.

---

## 9 · Security Rules

- **NEVER hardcode secrets** — use `process.env.VARIABLE_NAME`
- **NEVER commit `.env`** — it's in `.gitignore`
- All user input must be validated with Joi before it reaches any service
- Business logic must check `req.user.sub` and `req.membership.role` — never trust client-sent IDs for permissions
- The anti-fraud rule (Treasurer recording their own cash payment) is hardcoded and must never be bypassable

---

## 10 · Definition of Done

A task is DONE only when **all** of these are true:

- [ ] Works as specified in your task document
- [ ] Unit tests written and passing
- [ ] `npm run lint` clean
- [ ] PR opened with description and test steps
- [ ] One teammate reviewed and approved
- [ ] CTO merged to main

---

## 11 · Getting Help

- **Stuck for more than 30 minutes?** Post in WhatsApp immediately. No blocking.
- **Supabase credentials?** Ask the CTO.
- **MTN MoMo sandbox access?** Register at [developer.mtn.com](https://developer.mtn.com) — it takes 24–48h.
- **Telegram bot?** Create via [@BotFather](https://t.me/BotFather) on Telegram — instant.

---

*This document is maintained by the Scrum Master. Changes must be announced in WhatsApp.*

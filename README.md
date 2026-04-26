# NAAS — NjangiBridge (Njangi as a Service)

A multi-tenant SaaS web platform for managing Njangi rotating-savings groups in Cameroon.

Built for ICT University — SEN2241 Object-Oriented Analysis, Design and Implementation · Spring 2026

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML5 + Tailwind CSS 3 + Alpine.js 3 (PWA) |
| **Backend** | Node.js 20 + Express.js |
| **Database** | Supabase (PostgreSQL + RLS) |
| **Auth** | Supabase Auth (JWT + SMS OTP) |
| **Payments** | MTN MoMo Collection API + Orange Money |
| **Notifications** | Telegram Bot API + Africa's Talking SMS |
| **Scheduler** | node-cron |
| **PDF** | PDFKit |
| **API Docs** | Swagger UI at `/api-docs` |

---

## Repository Structure

```
Digital_Njangi_Platform/
├── .github/workflows/     # CI (lint+test) and deploy pipelines
├── app/                   # Frontend — role-based HTML pages
├── src/                   # Frontend — JS, CSS, assets (Vite)
├── public/                # Frontend — static assets, PWA manifest
├── backend/               # Node.js/Express API server
│   ├── src/
│   │   ├── app.js         # Express app entry point
│   │   ├── config/        # Supabase client, env validation, SQL schema
│   │   ├── middleware/    # JWT auth, tenant, role, error handlers
│   │   ├── modules/       # Feature modules (auth, groups, contributions…)
│   │   ├── services/      # Shared services (payment, notification, pdf…)
│   │   └── jobs/          # Cron schedulers
│   └── tests/             # Unit, integration, security, HTTP tests
├── docs/
│   ├── CONTRIBUTING.md    # Team onboarding & git workflow guide
│   └── tasks/             # Per-developer task plans
├── .eslintrc.json
├── .gitignore
└── package.json           # Frontend (Vite) build config
```

---

## Team

| Developer | Role | Branch Prefix | Module |
|-----------|------|--------------|--------|
| **[Lead]** | Scrum Master / CTO | `main`, `feature/lead/*` | Architecture, CI/CD, reviews |
| **Dev A** | Auth + Groups + Members | `feature/dev-a/*` | `backend/src/modules/auth` · `groups` · `members` |
| **Dev B** | Contributions + Payouts + Scheduler | `feature/dev-b/*` | `backend/src/modules/contributions` · `payouts` · `jobs/` |
| **Dev C** | Notifications + Fines + Reports + PDF | `feature/dev-c/*` | `backend/src/modules/fines` · `reports` · `services/notification` · `services/pdf` |
| **Dev D** | Testing + Swagger + Report | `feature/dev-d/*` | `backend/tests/` · `docs/` |

---

## Local Development Setup

### Prerequisites
- Node.js 20+
- A free [Supabase](https://supabase.com) project
- MTN MoMo sandbox credentials (register at [developer.mtn.com](https://developer.mtn.com))
- Telegram Bot token (create via [@BotFather](https://t.me/BotFather))

### 1 · Clone and install

```bash
git clone https://github.com/ghislainche-ngc/Digital-Njangi-Platform.git
cd Digital-Njangi-Platform
```

**Frontend (Vite dev server):**
```bash
npm install
npm run dev
# → http://localhost:5173
```

**Backend (Express API):**
```bash
cd backend
npm install
cp .env.example .env
# Fill in your values — ask the CTO for Supabase keys
npm run dev
# → http://localhost:3000
```

### 2 · Set up the database

1. Open your Supabase project → **SQL Editor**
2. Paste and run `backend/src/config/schema.sql`
3. Paste and run `backend/src/config/rls-policies.sql`

### 3 · Run tests

```bash
cd backend
npm test              # all tests
npm run test:unit     # unit tests only
npm run test:coverage # with coverage report
```

### 4 · API Documentation

Start the backend server, then visit:
```
http://localhost:3000/api-docs
```

---

## Branch & Commit Rules

- **Never commit directly to `main`** — always use a feature branch
- Branch naming: `feature/dev-a/auth-register` · `fix/dev-b/momo-retry`
- Commit messages must be descriptive:
  - ✅ `Add JWT middleware with tenant injection`
  - ✅ `Fix MoMo retry logic for failed deductions`
  - ❌ `fix` · `wip` · `update` · `asdfgh`
- Open a PR → get reviewed → CTO merges

See **[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)** for the full workflow.

---

## GitHub Actions Secrets

Configure these in **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|--------|---------|
| `JWT_SECRET_TEST` | 32+ char random string for test runs |
| `SUPABASE_URL_TEST` | Supabase project URL (test project) |
| `SUPABASE_SERVICE_KEY_TEST` | Supabase service role key (test) |
| `VPS_HOST` | VPS IP address (add when purchased) |
| `VPS_USER` | SSH username (`ubuntu` or `root`) |
| `VPS_SSH_KEY` | Private SSH key for VPS access |

---

## Sprint Schedule

| Week | Dates | Focus |
|------|-------|-------|
| Week 1 | Apr 28 – May 4 | Setup · DB schema · Auth API |
| Week 2 | May 5 – May 11 | Groups · Members · Contributions |
| Week 3 | May 12 – May 18 | Payout engine · Scheduler · Notifications |
| Week 4 | May 19 – May 25 | Fines · PDF · Swagger · Bug fixes |
| Buffer | May 26 – Jun 1 | Deployment · Report · Slides |

---

## License

Internal use only — ICT University project · Spring 2026

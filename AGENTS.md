# AGENTS.md
This file provides guidance to Verdent when working with code in this repository.

## Table of Contents
1. Commonly Used Commands
2. High-Level Architecture & Structure
3. Key Rules & Constraints
4. Development Hints

## Commands

### Frontend (Vite — root `package.json`)
- `npm install` — install frontend deps
- `npm run dev` — Vite dev server at `http://localhost:5173`
- `npm run build` — production build to `dist/`
- `npm run preview` — preview production build

### Backend (Express — `backend/package.json`)
- `cd backend && npm install` — install backend deps
- `npm run dev` — nodemon dev server at `http://localhost:3000`
- `npm start` — production server
- `npm run lint` — ESLint on `backend/src/`
- `npm test` — Jest (all tests, `--runInBand`)
- `npm run test:unit` — unit tests only (`tests/unit/`)
- `npm run test:integration` — integration tests
- `npm run test:coverage` — with coverage (threshold: 70% lines)
- `npm run test:watch` — watch mode

### CI/CD
- GitHub Actions CI: lint + test on every PR/push to `main` (`.github/workflows/ci.yml`)
- GitHub Actions Deploy: SSH to VPS, `pm2 restart naas-backend` (`.github/workflows/deploy.yml`)
- Secrets needed: `JWT_SECRET_TEST`, `SUPABASE_URL_TEST`, `SUPABASE_SERVICE_KEY_TEST`, `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`

## Architecture

### System Overview

```mermaid
graph TB
    subgraph Frontend["Frontend (Vite + Tailwind + Alpine.js)"]
        LP[Landing / Login / Register]
        RD[Role Dashboards<br>admin | president | treasurer | secretary | member]
    end

    subgraph Backend["Backend (Node.js 20 + Express 4)"]
        MW[Middleware Stack<br>auth → tenant → role → error]
        MOD[Feature Modules<br>auth | groups | members | contributions<br>payouts | fines | social-fund | reports]
        SVC[Shared Services<br>payment | notification | rotation | audit | pdf]
        JOBS[Cron Jobs<br>contribution | penalty | reminder]
    end

    subgraph DB["Supabase (PostgreSQL + RLS)"]
        TABLES[12 Tables<br>users | memberships | njangi_groups<br>cycles | contributions | payouts<br>fines | invitations | audit_events<br>payment_transactions | social_fund<br>otp_verifications]
    end

    subgraph EXT["External Services"]
        MOMO[MTN MoMo API]
        ORANGE[Orange Money API]
        TELE[Telegram Bot API]
        SMS[Africa's Talking SMS]
    end

    LP --> MW
    RD --> MW
    MW --> MOD
    MOD --> SVC
    SVC --> DB
    SVC --> EXT
    JOBS --> SVC
```

### Backend Layer Stack
- **Routes** (`*.routes.js`) — HTTP binding, Swagger JSDoc, middleware wiring
- **Controllers** (`*.controller.js`) — thin handlers, Joi validation, delegate to service
- **Services** (`*.service.js`) — all business logic, DB access via Supabase client
- **Shared Services** (`services/`) — pluggable infrastructure (payment, notification, rotation, audit, pdf)
- **Middleware** — `auth.middleware.js` (JWT verify) → `tenant.middleware.js` (group membership + enriches `req.group`, `req.membership`) → `role.middleware.js` (RBAC via `requireRole(...)`) → `error.middleware.js` (global catch)
- **Jobs** (`jobs/`) — `node-cron` schedulers (contribution 1st-of-month, penalty daily, reminder daily)

### Frontend Architecture
- **No SPA router** — file-based navigation, each role has its own HTML pages under `app/{role}/`
- **Boot sequence**: page defines its Alpine component → `boot.js` registers stores (`theme`, `i18n`) → `Alpine.start()` → for auth pages, `renderShell()` + `mountContent()` build the UI
- **Auth state**: `localStorage` keys `naas.jwt` and `naas.user`; `session.js` manages get/set/clear
- **API client**: `src/js/api/client.js` — thin fetch wrapper, auto-injects JWT Bearer header
- **i18n**: English (`en.js`) + French (`fr.js`), browser-language auto-detect, Alpine `$t('key.path')` magic
- **Theming**: light/dark/system via CSS class toggle on `<html>`, `localStorage` key `naas.theme`

### OOP Design Patterns in Use
| Pattern | Location | Purpose |
|---------|----------|---------|
| **Abstract Class** | `PaymentProvider`, `NotificationService`, `RotationStrategy` | Interface contracts with `new.target` guard |
| **Strategy** | `RotationStrategy` hierarchy + `RotationEngine` context | Payout recipient selection (Fixed / Random / PresidentDecision) |
| **Factory Method** | `payment/index.js::getProvider()`, `notification/index.js` | Instantiate correct provider by gateway name |
| **Singleton** | Most `*.service.js` files (exported as `new XService()`) | Single instance per module |
| **Dependency Injection** | `PayoutEngine`, `ContributionService`, `AuditService`, `FineService`, `ReportService` | Constructor-injected dependencies for testability |
| **Facade** | `PayoutEngine.execute()` | Coordinates 5 services behind one call |
| **Template Method** | `NotificationService.sendBulk()` calls abstract `send()` | Concrete method invoking abstract steps |
| **Chain of Responsibility** | Express middleware pipeline | `auth → tenant → role → handler → error` |
| **Null Object** | `PresidentDecisionStrategy` returns `null` | Signals "await manual nomination" |
| **Decorator** [inferred] | `tenantMiddleware` enriches `req` with `.group`, `.membership` | Request enrichment |
| **Factory Function** | `requireRole(...roles)` | Returns middleware closure |

### Database Schema (12 tables)
- `users`, `otp_verifications` — auth domain
- `njangi_groups`, `memberships`, `invitations`, `cycles` — group/tenant domain
- `contributions`, `payouts`, `payment_transactions` — financial domain
- `fines`, `social_fund`, `audit_events` — compliance domain
- Schema file: `backend/src/config/schema.sql`
- RLS policies: `backend/src/config/rls-policies.sql`

### Multi-Tenancy
- Each `njangi_group` is an isolated tenant
- `tenant.middleware.js` verifies user membership in `:groupId` on every request
- Supabase RLS policies enforce isolation at DB layer (defense-in-depth)

## Key Rules & Constraints

### From CLAUDE.md
- Never save working files to root — use `src/`, `tests/`, `docs/`, `config/`, `scripts/`
- Keep files under 500 lines
- Business logic in service classes only, never in controllers or routes
- Follow Domain-Driven Design with bounded contexts
- Run tests after code changes; verify build before committing

### From CONTRIBUTING.md
- **Never commit directly to `main`** — always feature branch → PR → review → merge
- Branch naming: `{type}/{dev-prefix}/{short-description}` (e.g., `feature/dev-a/auth-register`)
- Commit format: `type: short description` (types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`)
- All user input must be validated with Joi before reaching any service
- Never trust client-sent IDs for permissions — always check `req.user.sub` and `req.membership.role`
- Anti-fraud rule: treasurer cannot record their own cash payment (hardcoded, never bypass)

### Exam Requirements (SEN2241 — OOADI)
- **OOP is mandatory** — code must demonstrate Encapsulation, Abstraction, Inheritance, Polymorphism
- The exam panel will ask developers to point to specific code lines for each OOP pillar
- Swagger/OpenAPI API docs required at `/api-docs`
- Grading: Report (20%), Application (60%), Presentation (20%)
- **Web apps not deployed get graded at 50% of score**
- Individual grading based on: GitHub commit history, scrum master remarks, Q&A responses

### Team & Branch Ownership
- **3 active members** (originally 5, 2 removed for inactivity)
- Lead/Scrum Master: `main`, `feature/dev-a/*` branches — architecture, CI/CD, auth, groups, members
- Glory (teammate): has her own named branch — **do not modify her branch**
- Third member: not yet started
- Dev prefixes in use: `dev-a`, `dev-b`, `dev-c`, `dev-d` (mapped in `docs/tasks/`)

### Technology Constraints
- Backend: Node.js 20+, Express 4, CommonJS (`require`)
- Frontend: Vite 5, ES modules (`import`), Alpine.js 3, Tailwind CSS 3
- Database: Supabase (PostgreSQL + JS SDK + RLS) — service-role client in `backend/src/config/supabase.js`
- Auth: JWT signed with `jsonwebtoken`, bcrypt password hashing (12 rounds)
- Testing: Jest + Supertest, 70% coverage threshold
- No TypeScript — entire codebase is JavaScript

### Environment Variables
- Backend `.env` requires: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `JWT_SECRET`, `PORT`, `NODE_ENV`
- Optional integrations: `MTN_MOMO_*`, `ORANGE_MONEY_*`, `TELEGRAM_BOT_TOKEN`, `AFRICAS_TALKING_*`
- Frontend env (via Vite): `VITE_API_BASE_URL`, `VITE_DEFAULT_LOCALE`

## Development Hints

### Adding a New Backend Module
1. Create folder `backend/src/modules/{name}/`
2. Add files: `{name}.service.js` (business logic), `{name}.controller.js` (thin handler), `{name}.routes.js` (Express router + Swagger), `{name}.validation.js` (Joi schemas)
3. Export service as singleton: `module.exports = new NameService()`
4. Import and mount routes in `backend/src/app.js`: `app.use('/groups', nameRoutes)` (most modules nest under `/groups/:groupId`)
5. Apply middleware stack: `auth` → `tenant` → `requireRole(...)` as needed
6. Add unit tests in `backend/tests/unit/{name}.test.js`

### Adding a New Shared Service
1. Create `backend/src/services/{name}/` with an abstract base class (use `new.target` guard pattern from `PaymentProvider.js`)
2. Create concrete implementations extending the abstract class
3. Create `index.js` barrel with factory function
4. Inject via constructor (follow `AuditService` pattern: `constructor(supabaseClient)`)

### Adding a New Frontend Page
1. Create HTML file in `app/{role}/{page}.html`
2. Add rollup input entry in `vite.config.js` under `build.rollupOptions.input`
3. Page must import `renderShell` and `mountContent` from `src/js/components/app-shell.js`
4. Add nav entry in `NAV_BY_ROLE` in `app-shell.js`
5. Add i18n keys in both `src/js/i18n/en.js` and `src/js/i18n/fr.js`

### Extending the Middleware Pipeline
- New middleware goes in `backend/src/middleware/`
- Apply per-route in `*.routes.js`, not globally (except error handler which is global-last in `app.js`)
- Pattern: `module.exports = function myMiddleware(req, res, next) { ... next(); }`

### Known Issues [inferred]
- ~70% of backend service methods still throw `'Not implemented'` — well-scaffolded but needs implementation
- `supabase.js` reads `process.env` directly instead of importing `config/env.js` — minor inconsistency
- `ReportService` exported as class (not singleton) unlike other services — needs explicit instantiation
- Cron jobs (`jobs/`) auto-start on `require()` — wrap in `start()` functions for test isolation
- No `member.controller.js` — member routes use inline 501 handlers
- `JWT_EXPIRY` hardcoded in both `env.js` and `auth.service.js`
- No `group.validation.js` — group controller passes `req.body` without Joi validation

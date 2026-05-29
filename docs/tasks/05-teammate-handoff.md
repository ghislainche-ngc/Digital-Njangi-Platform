# Teammate Handoff — Independent Tasks

**Purpose:** Two group members each work on an isolated branch, push their own commits, and open a PR into `main`. After merge (use **"Create a merge commit"**, not squash), each teammate's commits stay in `main`'s history under their GitHub username — that's what makes their contribution visible to the panel.

---

## Assignment

| Slot | Big task | Small add-on(s) | Teammate (fill in) | GitHub handle |
|------|----------|-----------------|--------------------|---------------|
| Dev E | Task A — Treasurer frontend wiring | S1 (toast/spinner) + S2 (PWA manifest) | _____________ | @____________ |
| Dev F | Task B — CI + integration tests | S3 (`.env.example`) + S4 (root README) | _____________ | @____________ |

> Adjust the "small add-on" picks to taste — the small tasks at the bottom of this file are all independent and can be mixed freely.

---

## Branching & commit rules (share with both teammates)

1. Branch off latest `main`:
   ```bash
   git checkout main && git pull
   git checkout -b feature/dev-e/<feature-name>
   ```
2. **One feature per branch, one PR per branch.** Never bundle multiple features.
3. Conventional commits: `feat:`, `test:`, `ci:`, `docs:`, `fix:`, `chore:`.
4. Push regularly so commit history accumulates under your GitHub username:
   ```bash
   git push -u origin feature/dev-e/<feature-name>
   ```
5. Open a PR against `main`, link the GitHub issue (`Closes #N`), request review.
6. Maintainer merges with **"Create a merge commit"** to preserve individual commits.

---

# Task A — Treasurer frontend ↔ API wiring

**Owner:** Dev E
**Branch:** `feature/dev-e/treasurer-api-wiring`
**Estimated time:** 6–8 hours
**Why it matters:** The treasurer pages currently show hardcoded mock data ("10 000 FCFA", "March 2026"). They need to fetch live data from the backend API the rest of the team built.

### Scope

Wire these 4 pages to the backend via the existing `src/js/api/client.js`:

- [app/treasurer/contributions.html](../../app/treasurer/contributions.html) → `GET /api/contributions`
- [app/treasurer/payouts.html](../../app/treasurer/payouts.html) → `GET /api/payouts`
- [app/treasurer/fines.html](../../app/treasurer/fines.html) → `GET /api/fines`
- [app/treasurer/social-fund.html](../../app/treasurer/social-fund.html) → `GET /api/social-fund`

### Files you own (no overlap with anyone)

- `app/treasurer/*.html` — replace hardcoded data with mount points
- `src/js/treasurer/contributions.js` (new)
- `src/js/treasurer/payouts.js` (new)
- `src/js/treasurer/fines.js` (new)
- `src/js/treasurer/social-fund.js` (new)

### Deliverables

- All four pages render data from API calls — zero hardcoded amounts/dates
- Use the existing `glass-card`, `chip`, `btn-primary` Tailwind classes — don't restyle
- Show a loading skeleton while fetching, a toast/banner on error
- Auth token is read from `src/js/auth/session.js` (already exists)
- Add screenshots to the PR description

### Acceptance criteria

- [ ] Login as a treasurer → each page shows real data from the API
- [ ] Network panel shows the expected `fetch` calls
- [ ] If the API returns 401, the user is redirected to `/login.html`
- [ ] If the API returns 5xx, an error toast is shown (no white screen)
- [ ] No `console.log` left in production code
- [ ] All existing backend tests still pass (`cd backend && npm test`)

---

# Task B — CI pipeline + integration test coverage

**Owner:** Dev F
**Branch:** `feature/dev-f/ci-and-integration-tests`
**Estimated time:** 5–7 hours
**Why it matters:** Backend has unit tests but no automated CI. The money-flow services (contributions, payouts) only have unit tests — integration tests prove the full route → service → Supabase path works.

### Scope

1. **GitHub Actions workflow** at `.github/workflows/ci.yml`:
   - Trigger on `push` to any branch and `pull_request` targeting `main`
   - Steps: checkout → Node 20 → `cd backend && npm ci && npm test`
   - Cache `node_modules` between runs
2. **Two integration tests**, skip-guarded by `backend/.env.test` (follow the same pattern as the existing `tests/security/` files):
   - `backend/tests/integration/contribution.integration.test.js` — POST a contribution, GET the ledger, assert balance changed
   - `backend/tests/integration/payout.integration.test.js` — trigger a payout, assert audit log entry created
3. **Integration test setup guide** at `backend/tests/integration/README.md` explaining how to populate `.env.test` with a throwaway Supabase project.
4. **CI status badge** appended to whatever README ends up at the repo root (coordinate with Dev E if they're doing the README small task).

### Files you own (no overlap)

- `.github/workflows/ci.yml` (new)
- `backend/tests/integration/contribution.integration.test.js` (new)
- `backend/tests/integration/payout.integration.test.js` (new)
- `backend/tests/integration/README.md` (new)

### Acceptance criteria

- [ ] Opening a PR triggers the CI workflow; it runs green
- [ ] Workflow run page shows the teammate's GitHub username as the trigger
- [ ] Integration tests pass locally with `.env.test` configured
- [ ] Integration tests skip cleanly (not fail) when `.env.test` is absent
- [ ] CI badge renders in the README

---

# Small add-on tasks (mix & match)

Each is 1–3 hours, fully independent, and gives a clean separate commit/PR.

## S1 — Toast & spinner utility

**Branch:** `feature/dev-<x>/ui-toast-spinner`
**Files:** `src/js/ui/toast.js` (new), `src/js/ui/spinner.js` (new)
**Deliverable:** Two small modules — `showToast(message, level)` and `showSpinner(targetEl)`. Styled with existing Tailwind classes. Demo page or HTML comment block showing usage.

## S2 — PWA manifest + icons

**Branch:** `feature/dev-<x>/pwa-manifest`
**Files:** `manifest.webmanifest`, `public/icons/icon-192.png`, `public/icons/icon-512.png`
**Deliverable:** Valid manifest with name, theme color, icon set. Page passes Chrome's "Installable" audit in DevTools → Application.

## S3 — `.env.example` files

**Branch:** `feature/dev-<x>/env-example`
**Files:** `.env.example` (root), `backend/.env.example`
**Deliverable:** Every required env var listed with a placeholder value. **No real secrets.** Update `.gitignore` if needed to ensure `.env` is ignored but `.env.example` is tracked.

## S4 — Root project README

**Branch:** `feature/dev-<x>/root-readme`
**Files:** `README.md` (root)
**Deliverable:** What NAAS is, who built it, how to run frontend (`npm run dev`) and backend (`cd backend && npm start`), how to run tests, link to `docs/`. Add CI badge once Dev F's workflow is merged.

## S5 — French i18n completion

**Branch:** `feature/dev-<x>/i18n-french`
**Files:** [src/js/i18n/fr.js](../../src/js/i18n/fr.js), [src/js/components/app-shell.js](../../src/js/components/app-shell.js) (for the toggle)
**Deliverable:** Every key in `en.js` has a French translation in `fr.js`. Language toggle button added to the app shell — clicking it persists choice in `localStorage`.

## S6 — Architecture diagram

**Branch:** `feature/dev-<x>/architecture-diagram`
**Files:** `docs/architecture.md`
**Deliverable:** Single Mermaid diagram showing Frontend (PWA) ↔ Express API ↔ Supabase, with the OOP service classes labeled. 1–2 paragraphs of explanation. Useful for the panel.

## S7 — OOP pillars writeup

**Branch:** `feature/dev-<x>/oop-pillars-doc`
**Files:** `docs/oop-pillars.md`
**Deliverable:** One section per pillar (Abstraction, Encapsulation, Inheritance, Polymorphism). Each section quotes the relevant code (`NotificationService`, `PaymentProvider`, `RotationStrategy`, `DBConnect`) with line links. Direct deliverable for SEN3244.

## S8 — Seed/demo data script

**Branch:** `feature/dev-<x>/seed-demo-data`
**Files:** `backend/scripts/seed-demo.js`
**Deliverable:** Node script that creates 1 sample group, 5 members, 2 contribution cycles using the existing services (not raw SQL). Idempotent — running it twice doesn't duplicate. Document usage in script header.

## S9 — Health check endpoint

**Branch:** `feature/dev-<x>/health-endpoint`
**Files:** `backend/src/routes/health.js` (new), `backend/tests/unit/health.test.js` (new), wire it in `backend/src/app.js`
**Deliverable:** `GET /api/health` returns `{ status: 'ok', uptime, db: 'up'|'down' }`. Unit test covers both branches.

## S10 — Rate limiting on auth routes

**Branch:** `feature/dev-<x>/auth-rate-limit`
**Files:** `backend/src/middleware/rate-limit.js` (new), `backend/src/routes/auth.js` (edit), `backend/tests/unit/rate-limit.test.js` (new)
**Deliverable:** `express-rate-limit` applied to `/api/auth/login` and `/api/auth/register` (5 attempts / 15 min). Unit test verifies 6th attempt is blocked.

## S11 — Postman collection

**Branch:** `feature/dev-<x>/postman-collection`
**Files:** `docs/postman/njangi.postman_collection.json`
**Deliverable:** Export from the existing Swagger spec, organized into folders per module (auth, contributions, payouts, etc.). README snippet explaining how to import.

## S12 — 404 page

**Branch:** `feature/dev-<x>/404-page`
**Files:** `404.html`
**Deliverable:** Styled with existing `glass-card` classes, link back to `/`. Wire it in `vite.config.js` if needed.

---

## Quick start — issue body template

Paste this into a GitHub issue per task (replace bracketed bits):

```
## [Task A] Treasurer frontend ↔ API wiring

**Assignee:** @<teammate-handle>
**Branch:** `feature/dev-e/treasurer-api-wiring`
**Spec:** docs/tasks/05-teammate-handoff.md (Task A section)

### Acceptance criteria
- [ ] All four treasurer pages render data from the API
- [ ] No hardcoded amounts/dates remain
- [ ] Loading + error states implemented
- [ ] Existing tests still pass

### Notes
- Use existing client at src/js/api/client.js
- Don't restyle — reuse glass-card / chip / btn-primary
- One PR per task, conventional commits
```

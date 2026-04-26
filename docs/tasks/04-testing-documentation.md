# Module: Testing, API Documentation & Project Report

**Developer:** Dev D  
**Branch prefix:** `feature/dev-d/`  
**Areas owned:** `backend/tests/` · `docs/api/` · `docs/report/` · `docs/slides/`  
**Your role is unique:** You are the quality guardian. You write tests that catch bugs before they reach main, you document the API so the panel can verify the system works, and you write the final project report (20% of the grade). Start the report in Week 1 — do not leave it for Week 4.

---

## Responsibilities Overview

| Area | What you build |
|------|---------------|
| Unit tests | Jest unit tests for every service and engine |
| Integration tests | Supertest end-to-end API tests |
| Security tests | RLS tenant-isolation tests |
| Swagger docs | OpenAPI 3.0 documentation for every endpoint |
| HTTP test files | `.http` files for manual API testing |
| Project report | Word document following the exam chapter structure |
| Presentation | PowerPoint ≤ 20 slides |

---

## Testing Philosophy

| Level | What | Tool | When |
|-------|------|------|------|
| **Unit** | Service methods and OOP classes | Jest | Every PR |
| **Integration** | API endpoint → Supabase | Jest + Supertest | Every PR |
| **Security** | Group A cannot see Group B | Jest + Supabase | Week 2 |

---

## Week 1 — Task 1: Testing Infrastructure (Days 1–7)

**Branch:** `feature/dev-d/test-infrastructure`  
**Priority:** CRITICAL — every developer runs your test setup  
**Estimated time:** 4–5 hours

The skeleton is already in place. Your job:

1. Install test dependencies: `npm install --save-dev jest supertest @jest/globals`
2. Create `backend/.env.test` — copy from `.env.example`, fill with test Supabase project details
3. Verify `backend/tests/setup.js` loads correctly (`global.testUser` and `global.testGroup` are available)
4. Run existing unit tests: `npm test` → confirm arch tests pass (PaymentProvider, NotificationService, RotationEngine)
5. Verify the 4 `.http` files in `tests/http/` work against a running local server

**Expected output after this task:**
```
PASS tests/unit/payment.service.test.js
PASS tests/unit/notification.service.test.js
PASS tests/unit/rotation.test.js
PASS tests/unit/middleware.test.js
```

---

### Task 2: Auth Integration Tests (Days 5–7)

**Branch:** `feature/dev-d/auth-tests`  
**Estimated time:** 4–5 hours  
**Depends on:** Dev A's `feature/dev-a/auth-register` being merged

Create `backend/tests/integration/auth.api.test.js`:

```js
const request = require('supertest');
const app = require('../../src/app');

describe('POST /auth/register', () => {
  it('returns 201 and message on success');
  it('returns 409 when email already exists');
  it('returns 400 for missing required fields');
});

describe('POST /auth/login', () => {
  it('returns token on correct credentials');
  it('returns 401 on wrong password');
});

describe('GET /health', () => {
  it('returns 200 with status ok');
});
```

---

## Week 2 — Task 3: RLS Security Tests (Most Important Test)

**Branch:** `feature/dev-d/rls-security-tests`  
**Priority:** CRITICAL — the panel WILL ask about this  
**Estimated time:** 5–6 hours

Create `backend/tests/security/rls.test.js`. This test proves tenant isolation.

```js
describe('Row-Level Security — Tenant Isolation', () => {
  it('Group A member cannot read Group B contributions → 403');
  it('Group B member cannot read Group A ledger → 403');
  it('Group B member cannot trigger Group A payout → 403');
  it('Group B member cannot view Group A members → 403');
  it('Unauthenticated request → 401');
});
```

Use `createTestGroup()` from `tests/helpers/group.helper.js` to create the two groups.
Clean up after the test using `cleanTestGroup()` from `tests/helpers/db.helper.js`.

---

### Task 4: Group & Member Tests (Days 8–14)

**Branch:** `feature/dev-d/group-member-tests`  
**Estimated time:** 4–5 hours

Create `backend/tests/integration/group.api.test.js`:

```js
describe('POST /groups', () => {
  it('creates group and assigns creator as president');
  it('returns 400 for missing contribution_amount');
  it('returns 400 for invalid rotation_type');
});

describe('PATCH /groups/:groupId', () => {
  it('president can update contribution amount');
  it('treasurer cannot update settings → 403');
  it('cannot change rotation type mid-cycle → 400');
});

describe('POST /groups/:groupId/invitations', () => {
  it('president can invite a member by phone');
  it('member cannot invite → 403');
  it('duplicate invite → 409');
});
```

---

## Week 3 — Task 5: Swagger API Documentation (Days 15–21)

**Branch:** `feature/dev-d/swagger-docs`  
**Priority:** HIGH — required for exam  
**Estimated time:** 8–10 hours

**Install:**
```bash
cd backend
npm install swagger-jsdoc swagger-ui-express
```

Swagger is already wired in `backend/src/app.js`. Your job is to add JSDoc annotations to every route file.

**Template for a route:**
```js
/**
 * @swagger
 * /groups/{groupId}/contributions:
 *   get:
 *     summary: List contributions for current cycle
 *     tags: [Contributions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of contributions }
 *       401: { description: Not authenticated }
 *       403: { description: Not a member of this group }
 */
```

**Every endpoint needs:**
- Summary
- Tags (match the module name)
- Request body schema with examples (for POST/PATCH)
- All response codes: 200/201, 400, 401, 403, 409, 500
- `security: [{ bearerAuth: [] }]` for protected routes

**Done when:**
- `http://localhost:3000/api-docs` renders all endpoints
- Every endpoint has at least one example request and all response codes

---

## Weeks 3–4 — Task 6: Project Report

**Branch:** `feature/dev-d/project-report`  
**Estimated time:** 12–15 hours (spread across all weeks)  
**Deliverable:** `docs/report/NAAS_Project_Report.docx`

**Write one section per week — don't save it for Week 4.**

### Chapter Structure

**Chapter 1: Introduction**
- General Introduction — what is Njangi? why digitize it? what is NAAS?
- Aim and Objectives — specific, measurable goals
- Problem Statement — fraud, missed payments, no transparency, no receipts

**Chapter 2: Literature Review**
- Software methodologies: Waterfall vs Agile vs Scrum (why we chose Scrum)
- Related concepts: ROSCAs, Mobile Money in West Africa, SaaS multi-tenancy
- Related work: similar apps (Esusu, Cowrywise group savings) and what NAAS does differently

**Chapter 3: Methodology & Materials**
- Research methodology — how survey of 14 groups shaped requirements
- Functional Requirements — table of all PR-01 to PR-42
- Non-Functional Requirements — NFR-01 to NFR-15
- System architecture diagram
- UML diagrams (render mermaid source files from `docs/uml/` at mermaid.live)
- OOP application — Encapsulation, Inheritance, Polymorphism, Abstraction with code examples
- Scrum application — sprints, backlog, standups, PR reviews
- Test case document — table: test | input | expected | actual | pass/fail
- Proposed algorithms — payout eligibility and rotation selection in pseudocode
- Technologies table

**Chapter 4: Results and Discussions**
- Screenshots of every major screen (running application)
- Swagger UI screenshots with sample API calls
- Test coverage report screenshot

**Chapter 5: Recommendations and Conclusion**
- What the team achieved
- Difficulties encountered
- Recommendations: credit scoring, micro-loans, bank integrations

---

### Task 7: PowerPoint Presentation (≤ 20 Slides)

**Branch:** `feature/dev-d/presentation`  
**Estimated time:** 4–5 hours  
**Deliverable:** `docs/slides/NAAS_Presentation.pptx`

| Slide | Content |
|-------|---------|
| 1 | Title — NAAS, team names, date |
| 2 | What is Njangi? (cultural context) |
| 3 | Problem statement |
| 4 | Our solution — NAAS overview |
| 5 | Survey findings |
| 6 | System architecture diagram |
| 7 | Tech stack table |
| 8 | OOP class hierarchy |
| 9 | OOP 4 pillars with code examples |
| 10 | User roles & dashboards |
| 11 | Use case diagram |
| 12 | Payout engine flow (sequence diagram) |
| 13 | MoMo integration screenshots |
| 14 | Security — RLS + anti-fraud rules |
| 15 | Scrum — sprints, Trello, standups |
| 16 | API docs (Swagger screenshot) |
| 17 | Test coverage report |
| 18 | Live demo slide |
| 19 | Challenges & solutions |
| 20 | Conclusion + Q&A |

---

## Week 4 — Task 8: Payout & Contribution Tests

**Branch:** `feature/dev-d/payment-tests`  
**Estimated time:** 5–6 hours

Create `backend/tests/integration/contribution.api.test.js` and `payout.api.test.js`:

```js
// contribution tests
it('failed MoMo deduction is retried once automatically');
it('Treasurer cash payment for themselves triggers fraud alert');
it('successful deduction creates a receipt in DB');

// payout tests
it('blocks when pot not fully collected');
it('blocks when recipient has unpaid fines');
it('blocks without linked wallet');
it('blocks above threshold without President approval');
it('executes and notifies all members when all checks pass');
```

---

## PR Template

```markdown
## What this PR adds
[One sentence]

## Tests added
- Unit: X new tests
- Integration: X new tests
- All existing tests still passing ✓

## Coverage
- Before: X%
- After: X%

## Checklist
- [ ] npm test passes
- [ ] Swagger updated for new endpoints
- [ ] No secrets in code
```

---

## Important Notes

- **Report is 20% of the grade.** Write a section every week.
- **Coverage target: 70%+.** The CI pipeline enforces this.
- **Swagger:** Every endpoint must be documented. The panel may test the API directly through Swagger UI.
- **OOP in the presentation:** Be ready to open the code and point to the exact lines for each OOP pillar. The panel will ask.
- If you find a bug, open a GitHub Issue immediately and post in WhatsApp. Don't let broken code sit on any branch for more than a day.

# Module: Notifications, Fines, Social Fund & Reports

**Developer:** Dev C  
**Branch prefix:** `feature/dev-c/`  
**Modules owned:** `backend/src/services/notification/` · `src/services/audit/` · `src/services/pdf/` · `src/modules/fines/` · `src/modules/social-fund/` · `src/modules/reports/`  
**Dependency:** Dev B's payout engine imports `NotificationService`. Get **Task 1** merged by end of Week 1 so Dev B is unblocked.

---

## Responsibilities Overview

You own everything that happens **after** money moves — notifications, fines, reports, and PDFs. Your work makes the platform feel real and trustworthy to members.

| Area | What you build |
|------|---------------|
| NotificationService | Abstract class + Telegram + SMS implementations |
| AuditService | Log every financial action permanently |
| Fines | Record, pay, waive fines |
| Social Fund | Deposit, withdraw, balance tracking |
| Reports | Ledger, summary, personal history |
| PDF Generation | PDFKit reports and receipts |

---

## Week 1 — Task 1: Notification Service (Days 1–7)

**Branch:** `feature/dev-c/notification-service`  
**Priority:** CRITICAL — Dev B's payout engine imports this  
**Estimated time:** 6–8 hours

The abstract class and skeletons are in `backend/src/services/notification/`.

**Implement `TelegramNotificationService.send(chatId, message)`:**

```
POST https://api.telegram.org/bot{TOKEN}/sendMessage
Body: { chat_id: chatId, text: message, parse_mode: 'HTML' }
```

Get `TELEGRAM_BOT_TOKEN` from `@BotFather` — instant, no approval needed.
Store each user's `telegram_chat_id` in `users.telegram_chat_id` when they connect via the profile page.

**CRITICAL rule:** `send()` must NEVER throw. Return `{ success: false, error: err.message }` on failure.
`sendBulk()` uses `Promise.allSettled()` — one failure must not stop other notifications.

**Implement `SMSNotificationService.send(phone, message)`:**
Africa's Talking SMS API — install: `npm install africastalking`

**MockNotificationService (for tests and local dev):**
Create a mock that logs to console instead of calling Telegram. Swap via factory pattern — just change one line.

**Tests (`tests/unit/notification.service.test.js`):**
Tests are already written. Make them pass.

---

### Task 2: Audit Service (Days 5–7)

**Branch:** `feature/dev-c/audit-service`  
**Estimated time:** 3–4 hours

Implement `AuditService.log()` in `backend/src/services/audit/AuditService.js`.
The class and `AuditEvents` constants are already scaffolded — just implement the `log()` method.

**Rule:** `log()` must NEVER crash the main flow. Use `console.error` on failure, never `throw`.

---

## Week 2 — Task 3: Fines Module (Days 8–14)

**Branch:** `feature/dev-c/fines-module`  
**Estimated time:** 5–6 hours

Implement `FineService` in `backend/src/modules/fines/fine.service.js`. The routes file is scaffolded.

**Methods to implement:**

```js
recordFine(groupId, memberId, amount, reason, recordedBy)
markPaid(fineId, paidBy, paymentMethod)
waiveFine(fineId, waivedBy, reason)   // ← 400 if no reason provided
getMemberUnpaidFines(groupId, memberId)
hasUnpaidFines(groupId, memberId)     // ← used by PayoutEngine eligibility check
```

**Business rules:**
- Fine amount must be > 0
- Waiver REQUIRES a `reason` — throw 400 if missing
- Every waiver is logged in `audit_events` with: waivedBy, reason, timestamp
- Treasurer cannot waive their own fines — President must do it
- A member with unpaid fines is blocked from receiving payouts

**Tests (`tests/unit/fine.service.test.js`):**
- Record fine → appears in unpaid list
- Waiver without reason → 400 error
- Waiver logged in audit_events with waivedBy and reason
- `hasUnpaidFines` returns true when unpaid fine exists

---

### Task 4: Social Fund Module (Days 8–14)

**Branch:** `feature/dev-c/social-fund`  
**Estimated time:** 3–4 hours

Implement `SocialFundService` in `backend/src/modules/social-fund/social-fund.service.js`.

**Methods:**
```js
getBalance(groupId)          // SUM(deposits) - SUM(withdrawals)
recordDeposit(groupId, amount, reason, recordedBy)
recordWithdrawal(groupId, amount, reason, recordedBy)
  // ← 400 if withdrawal amount > current balance
```

**Tests:**
- Deposit 5000 → balance is 5000
- Withdraw 3000 → balance is 2000
- Withdraw 3000 from 2000 → 400 (insufficient funds)

---

## Week 3 — Task 5: Reporting Module (Days 15–21)

**Branch:** `feature/dev-c/reports`  
**Estimated time:** 6–7 hours

Implement `ReportService` in `backend/src/modules/reports/report.service.js`.

**Ledger format (immutable — no edits, corrections appear as new entries):**

```json
{
  "group": { "name": "...", "currentBalance": 150000 },
  "cycles": [
    {
      "cycleNumber": 1,
      "status": "completed",
      "contributions": [
        { "memberName": "Alice", "amount": 10000, "status": "confirmed", "date": "..." }
      ],
      "payout": { "recipientName": "Alice", "amount": 90000, "date": "..." }
    }
  ]
}
```

**Methods:**
```js
getLedger(groupId)
getSummary(groupId)
getPersonalHistory(groupId, userId)
generatePDFReport(groupId)   // calls PDFService → uploads to Supabase Storage
```

---

### Task 6: PDF Generation Service (Days 15–21)

**Branch:** `feature/dev-c/pdf-service`  
**Estimated time:** 6–8 hours

`PDFService` is already scaffolded in `backend/src/services/pdf/PDFService.js`.
It has working skeleton implementations for `generateLedgerReport()` and `generateReceiptPDF()`.

**Your job:**
1. Complete the contribution row rendering in `generateLedgerReport()`
2. Implement the Supabase Storage upload in `ReportService.generatePDFReport()`:

```js
const { data } = await supabase.storage
  .from('receipts')
  .upload(`${groupId}/reports/${Date.now()}.pdf`, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  });
const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(data.path);
return urlData.publicUrl;
```

**Tests:**
- `generateLedgerReport` returns a Buffer with length > 0
- `generateReceiptPDF` returns a valid PDF buffer
- Generated buffer starts with `%PDF` (PDF magic bytes)

---

## Week 4 · Integration

1. Verify notifications fire correctly for every payment scenario
2. Fix any bugs in fines or social fund found during integration testing
3. Generate sample PDFs and verify layout in a PDF viewer
4. Test Supabase Storage uploads and verify download URLs work
5. Write missing tests identified by Dev D

---

## PR Template

```markdown
## What this PR does
[One sentence]

## Telegram tested?
- [ ] Payment reminder sent ✓
- [ ] Payout notification sent to all members ✓
- [ ] Fraud alert sent to President ✓

## PDF tested?
- [ ] Ledger report generates without error
- [ ] Receipt uploads to Supabase Storage
- [ ] Download URL is accessible

## Checklist
- [ ] NotificationService abstraction used (no direct Telegram calls outside service)
- [ ] All errors caught — notification failures don't crash main flow
- [ ] Audit log entry for every fine and waiver
- [ ] No secrets in code
```

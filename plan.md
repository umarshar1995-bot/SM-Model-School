# Fee Payment System Upgrade — Implementation Plan

Goal: make fees **fool-proof**, **auditable**, and **editable only by the Administrator**, covering **monthly, exam, promotion and books fees**.

Stack: Next.js 15 (App Router) · TypeScript · Prisma (PostgreSQL `SM_School`) · custom JWT auth (`src/lib/auth.ts`).

---

## 0. Current State (what exists today)

| Area | File | Problem |
| --- | --- | --- |
| Fee structure API | `src/app/api/admin/fee-structures/route.ts` | Only checks "logged in", not Administrator |
| Fees / payments API | `src/app/api/admin/fees/route.ts` | Any signed-in user can generate challans and collect payments |
| Fee engine | `src/lib/fee-service.ts` | No overpayment check, receipt number uses `count()+1` (race condition), no reversal, no late fine |
| Structure columns | table `class_fee_structures` | tuition, admission, exam, computer, activity, late_fine. **No promotion or books fee** |
| Audit | none | No record of who changed what |
| Roles | `roles`, `model_has_roles` | Roles: Super Admin, Registrar, Teacher, Accountant, super_admin |

---

## 1. Decisions to confirm first

Answer these before coding; the rest of the plan assumes the recommended option.

| # | Question | Recommended |
| --- | --- | --- |
| 1 | Promotion fee: once when a student moves up a class, or monthly? | **Once**, charged when the student is promoted |
| 2 | Books fee: once per year, or in a monthly challan? | **Once per session**, on the first challan of the session |
| 3 | Exam fee: per term, or monthly? | **Per exam term** (e.g. Mid-term, Final) |
| 4 | Can an Accountant collect payments? | **Yes**, but cannot edit fees or reverse payments |
| 5 | Who can reverse a payment? | **Administrator only**, with a mandatory reason |

---

## 2. Role & Permission Model

Add these permission names (Spatie-style, `Action:Resource`, matching existing data):

| Permission | Administrator | Accountant | Registrar | Teacher |
| --- | :-: | :-: | :-: | :-: |
| `ViewAny:Fee` | ✅ | ✅ | ✅ | ❌ |
| `Update:FeeStructure` (edit any fee amount) | ✅ | ❌ | ❌ | ❌ |
| `Create:FeeChallan` (generate challans) | ✅ | ✅ | ❌ | ❌ |
| `Create:FeePayment` (collect fees) | ✅ | ✅ | ❌ | ❌ |
| `Reverse:FeePayment` | ✅ | ❌ | ❌ | ❌ |
| `ViewAny:FeeAudit` | ✅ | ❌ | ❌ | ❌ |

Rules:
- "Administrator" = a user with role `Super Admin` / `super_admin` (already `isSuperAdmin` in `getSessionUser()`).
- Enforce on the **server in every route handler** using `requireApiUser("<permission>")`. Hiding buttons in the UI is a convenience only.
- Seed the new permissions and assign them to roles with a one-off script (idempotent, `upsert`).

---

## 3. Database Changes

Run as SQL (or a Prisma migration), then `npx prisma db pull && npx prisma generate`. **Back up the database first.**

### 3.1 New table `fee_types`
Catalog of chargeable fees.

| Column | Type | Notes |
| --- | --- | --- |
| id | bigserial PK | |
| code | varchar(30) unique | `MONTHLY`, `EXAM`, `PROMOTION`, `BOOKS` |
| name | varchar(100) | Display name |
| frequency | varchar(20) | `monthly` / `per_term` / `once_per_session` / `on_promotion` |
| is_active | boolean default true | |
| sort_order | int | |
| created_at, updated_at | timestamp | |

Seed 4 rows: MONTHLY, EXAM, PROMOTION, BOOKS.

### 3.2 New table `class_fee_amounts`
Amount per class + session + fee type (replaces fixed columns over time).

| Column | Type | Notes |
| --- | --- | --- |
| id | bigserial PK | |
| school_class_id | bigint FK → school_classes | |
| academic_session_id | bigint FK → academic_sessions | |
| fee_type_id | bigint FK → fee_types | |
| amount | numeric(10,2) CHECK (amount >= 0) | |
| updated_by_user_id | bigint FK → users | Who last changed it |
| created_at, updated_at | timestamp | |

Unique: `(school_class_id, academic_session_id, fee_type_id)`.

> Migration step: copy existing `tuition_fee` → MONTHLY and `exam_fee` → EXAM rows for every existing `class_fee_structures` row. Keep the old table for now; remove only after verifying.

### 3.3 New table `fee_audit_logs`
Append-only. **Never update or delete rows.**

| Column | Type |
| --- | --- |
| id | bigserial PK |
| user_id | bigint FK → users |
| user_name | varchar(255) (snapshot) |
| action | varchar(50) — `FEE_AMOUNT_CHANGED`, `CHALLAN_GENERATED`, `PAYMENT_RECORDED`, `PAYMENT_REVERSED`, `LATE_FINE_APPLIED`, `LOGIN_DENIED_FEE_EDIT` |
| entity_type | varchar(50) |
| entity_id | bigint |
| old_values | jsonb |
| new_values | jsonb |
| reason | text null |
| ip_address | varchar(45) null |
| created_at | timestamp default now() |

Add a DB rule/trigger that blocks `UPDATE` and `DELETE` on this table.

### 3.4 Changes to existing tables

**`fee_payments`** — add:
- `idempotency_key varchar(80) unique null` (stops double submits)
- `status varchar(20) default 'posted'` (`posted` / `reversed`)
- `reversed_at timestamp null`, `reversed_by_user_id bigint null`, `reversal_reason text null`
- CHECK `amount_paid > 0`

**`family_fee_challans`** — add CHECK constraints:
- `paid_amount >= 0`
- `paid_amount <= payable_after_due`

**`student_fees`** — add `fee_type_id bigint null` and `student_enrollment_id bigint null` so promotion/books/exam charges can be tracked per student and not double-billed.

**New sequence `receipt_no_seq`** — replace `count()+1` receipt numbering.

---

## 4. Backend Plan (`src/lib`, `src/app/api/admin`)

### 4.1 Authorization helper
- Extend `requireApiUser()` in `src/lib/api-helpers.ts` to always log a `fee_audit_logs` row when a **denied** fee-edit attempt happens.
- Add `requireAdministrator()` = `user.isSuperAdmin` check, returns 403 otherwise.

### 4.2 Fee catalog & amounts APIs
- `GET /api/admin/fee-types` — list.
- `GET /api/admin/fee-amounts?sessionId=` — matrix of class × fee type.
- `PUT /api/admin/fee-amounts` — **Administrator only**. Validate with zod (`amount` 0–1,000,000, 2 decimals). In one transaction: update amount, set `updated_by_user_id`, write audit row with old + new value.
- Remove edit capability from `/api/admin/fee-structures` (keep GET only), or make it Administrator-only.

### 4.3 Billing engine (`src/lib/fee-service.ts`)
Rewrite `generateFamilyChallan` to build line items by fee type:

1. **MONTHLY** — every active student, every month. Sibling discount (0 / 20 / 50 %) applies **only to monthly tuition**.
2. **EXAM** — added when the Administrator opens an "exam term" billing run for that term.
3. **BOOKS** — added once per student per session (skip if a `student_fees` row with `fee_type_id = BOOKS` already exists for that session).
4. **PROMOTION** — added when a student is promoted to the next class (see 4.5).
5. Arrears from unpaid earlier months (existing behaviour, keep).
6. Regenerating a challan must **never reduce** `paid_amount`; it recalculates dues only.

All money math in **integer paisa** or `Prisma.Decimal` — no floating point addition.

### 4.4 Payment service — fool-proof rules
`recordChallanPayment()` must, inside one `SERIALIZABLE` transaction:

- Lock the challan row (`SELECT … FOR UPDATE`).
- Reject if challan status is `paid` or amount ≤ 0.
- Reject if `amountPaid` > remaining due (no overpayment). Show remaining due in the error.
- Require an `idempotencyKey` from the client (UUID generated when the modal opens); if the key already exists return the **original** payment instead of creating a second one.
- Generate receipt number from `receipt_no_seq` (`REC-YYYYMM-00001`).
- Require a reference number when method ≠ Cash.
- Allocate payment: arrears first, then oldest student fee first.
- Write `PAYMENT_RECORDED` audit row.

New `reversePayment(paymentId, reason)` — Administrator only:
- Requires reason ≥ 10 characters.
- Marks payment `reversed` (never delete), subtracts from challan and student fees, recalculates statuses.
- Writes `PAYMENT_REVERSED` audit row.

### 4.5 Promotion fee trigger
- When an enrollment is created for a student in a **new session with a higher class**, create one `student_fees` row for fee type PROMOTION (amount from `class_fee_amounts` for the **new** class).
- Unique guard: one PROMOTION row per student per session.

### 4.6 Late fine
- Add a daily job (`GET /api/cron/late-fines`, protected by a secret header) that, for challans past `due_date` and unpaid/partial, applies the fine **once** and marks `LATE_FINE_APPLIED` in audit.
- Schedule with Windows Task Scheduler or the host's cron.

### 4.7 Receipts
- `GET /print/receipt/[paymentId]` — print page with school header, receipt no., family, amount in words (`numberToWords`), method, reference, collector name, and "REVERSED" watermark if reversed.

---

## 5. Frontend Plan

### 5.1 New page: Fee Settings — `/admin/fee-settings` (Administrator only)
- Matrix: rows = classes, columns = MONTHLY / EXAM / PROMOTION / BOOKS, for the selected session.
- Inline edit with a **confirm dialog** showing `old → new` before saving.
- Non-administrators: page returns 403 / is hidden from the sidebar; if reached, inputs are disabled.
- "History" drawer per cell showing audit rows.

### 5.2 Fees & Challans console (`/admin/fees-console`)
- **Collect modal**:
  - Amount input capped at remaining due, with a "Pay full" button.
  - Live "balance after payment" preview.
  - Disable submit while request in flight (stops double-click).
  - Generate and send `idempotencyKey`.
  - Reference field required for non-cash.
  - Confirmation step: "Collect Rs. X from FAM-1042?"
- Payment history list per challan with **Print Receipt** and (Administrator only) **Reverse** with required reason.
- Hide "Generate challans" for roles without `Create:FeeChallan`.

### 5.3 Audit viewer — `/admin/fee-audit` (Administrator only)
- Filterable table: date range, user, action, family.
- Read-only, CSV export.

### 5.4 Sidebar
- Add "Fee Settings" and "Fee Audit" under *Fees Management*, shown only when the user has the permission (pass `permissions` into `AdminShell`).

---

## 6. Security & Fool-Proofing Checklist

- [x] Every fee route checks a permission on the **server**.
- [x] Fee amount edits only by Administrator; denied attempts logged.
- [x] No overpayment; no zero/negative payment.
- [x] Duplicate submit returns the same receipt (idempotency key).
- [x] Receipt numbers from a DB sequence (no collisions).
- [x] Payments are **never deleted**; reversal keeps history.
- [x] Audit table is append-only (trigger blocks update/delete).
- [x] DB CHECK constraints back up the app rules.
- [x] Money uses `Decimal`/integer paisa, never floats.
- [x] Rate-limit the login route (e.g. 5 attempts / minute / IP).
- [x] Remove the fallback `SESSION_SECRET` in `src/lib/auth.ts`; fail to start if unset in production.
- [ ] Change the admin password and DB password after go-live; keep `.env` out of version control.
- [ ] Nightly `pg_dump` backup of `SM_School`.

---

## 7. Testing Plan

Create `tests/` (Vitest) with a separate test database.

**Unit**
- Sibling discount: 1st child 0 %, 2nd 20 %, 3rd+ 50 % on tuition only.
- Books fee billed once per session; promotion fee once per promotion.
- Arrears roll-forward; regenerating a challan keeps `paid_amount`.
- `numberToWords` for 0, 999, 100000, 10000000.

**Integration (API)**
- Accountant `PUT /fee-amounts` → **403**; Administrator → 200 and audit row exists.
- Payment > remaining due → **422**.
- Same `idempotencyKey` twice → one payment, same receipt.
- Two parallel payments on one challan → total never exceeds payable.
- Reversal without reason → 422; with reason → challan reopens, audit row written.
- Audit table `UPDATE`/`DELETE` → rejected.

**Manual QA script**
1. Log in as Administrator, set Class 5 fees (Monthly 3800, Exam 400, Promotion 500, Books 1500).
2. Generate April challans; confirm line items and sibling discount.
3. Log in as Accountant; confirm fee settings are read-only/hidden.
4. Collect partial payment, print receipt, collect remainder.
5. Try to overpay and double-click — both blocked.
6. Reverse a payment as Administrator; confirm audit entry.

---

## 8. Rollout Order (suggested)

| Step | Work | Est. |
| --- | --- | --- |
| 1 | Back up DB; answer section 1 questions | 0.5 h |
| 2 | Section 3 SQL: new tables, columns, constraints, sequence, seed fee types | 2 h |
| 3 | Permissions seed + `requireAdministrator()` + audit helper | 2 h |
| 4 | Lock down existing fee routes (quick safety win) | 1 h |
| 5 | Payment service rewrite (4.4) + receipt page | 4 h |
| 6 | Fee amounts API + Fee Settings page | 4 h |
| 7 | Billing engine by fee type (4.3) + promotion trigger (4.5) | 5 h |
| 8 | Reversal flow + audit viewer | 3 h |
| 9 | Late-fine job | 1.5 h |
| 10 | Tests (section 7) + manual QA | 4 h |
| 11 | Security checklist (section 6) | 2 h |

**Do step 4 first** — it closes the biggest hole (any logged-in user can edit fees) in under an hour, before the larger redesign.

---

## 9. Files to Create / Change

**Create**
- `src/app/admin/fee-settings/page.tsx`
- `src/app/admin/fee-audit/page.tsx`
- `src/app/api/admin/fee-types/route.ts`
- `src/app/api/admin/fee-amounts/route.ts`
- `src/app/api/admin/fee-audit/route.ts`
- `src/app/api/admin/fees/reverse/route.ts`
- `src/app/api/cron/late-fines/route.ts`
- `src/app/print/receipt/[paymentId]/page.tsx`
- `src/lib/audit.ts`
- `prisma` SQL migration file for section 3
- `tests/` suite

**Change**
- `src/lib/api-helpers.ts` — `requireAdministrator()`, denied-attempt logging
- `src/lib/fee-service.ts` — rewrite per sections 4.3–4.6
- `src/app/api/admin/fees/route.ts` — permissions, idempotency key, new errors
- `src/app/api/admin/fee-structures/route.ts` — read-only or Administrator-only
- `src/app/admin/fees-console/page.tsx` — safer collect modal, history, reverse
- `src/components/layout/AdminShell.tsx` — permission-aware sidebar
- `src/app/admin/layout.tsx` — pass `permissions` to the shell
- `src/lib/auth.ts` — remove fallback secret
- `prisma/schema.prisma` — via `db pull` after SQL

---

## 10. Definition of Done

- Only the Administrator can change monthly, exam, promotion and books fee amounts — proven by a 403 test for every other role.
- A payment can never exceed what is owed, and can never be recorded twice.
- Every fee change, payment and reversal appears in the audit log with who, when, old and new values.
- Receipts print for every payment; reversed payments show a watermark.
- All tests in section 7 pass and `npm run build` is clean.

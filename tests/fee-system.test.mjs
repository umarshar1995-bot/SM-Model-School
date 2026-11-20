import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import crypto from "node:crypto";

const require = createRequire(new URL("../package.json", import.meta.url));
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const BASE_URL = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const CRON_SECRET =
  process.env.CRON_SECRET ||
  process.env.SESSION_SECRET ||
  "dev-only-sm-school-session-secret";

const prisma = new PrismaClient();

// Local mirror of numberToWords to unit-test exact boundary numbers from plan.md §7
function numberToWords(input) {
  let num = Math.max(0, Math.round(input));
  if (num === 0) return "Zero Rupees Only";
  const ones = {
    1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five",
    6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten",
    11: "Eleven", 12: "Twelve", 13: "Thirteen", 14: "Fourteen",
    15: "Fifteen", 16: "Sixteen", 17: "Seventeen", 18: "Eighteen", 19: "Nineteen",
  };
  const tens = {
    2: "Twenty", 3: "Thirty", 4: "Forty", 5: "Fifty",
    6: "Sixty", 7: "Seventy", 8: "Eighty", 9: "Ninety",
  };
  const helper = (n) => {
    if (n < 20) return ones[n] ?? "";
    const t = Math.floor(n / 10);
    const o = n % 10;
    return `${tens[t] ?? ""}${o > 0 ? " " + (ones[o] ?? "") : ""}`;
  };
  const words = [];
  if (num >= 10000000) {
    words.push(`${helper(Math.floor(num / 10000000))} Crore`);
    num %= 10000000;
  }
  if (num >= 100000) {
    words.push(`${helper(Math.floor(num / 100000))} Lakh`);
    num %= 100000;
  }
  if (num >= 1000) {
    words.push(`${helper(Math.floor(num / 1000))} Thousand`);
    num %= 1000;
  }
  if (num >= 100) {
    words.push(`${helper(Math.floor(num / 100))} Hundred`);
    num %= 100;
  }
  if (num > 0) words.push(helper(num));
  return `Rupees ${words.join(" ")} Only`;
}

async function waitForServer(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/login`);
      if (res.ok) return;
    } catch {
      // retry until ready
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${BASE_URL} did not become ready in ${timeoutMs}ms`);
}

async function loginAs(identifier, password, fakeIp) {
  const headers = { "Content-Type": "application/json" };
  if (fakeIp) headers["x-forwarded-for"] = fakeIp;
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({ username: identifier, password }),
  });
  const setCookie = res.headers.get("set-cookie") || "";
  const cookieMatch = setCookie.match(/sm_school_session=[^;]+/);
  return {
    status: res.status,
    cookie: cookieMatch ? cookieMatch[0] : "",
    body: await res.json().catch(() => ({})),
  };
}

async function apiFetch(path, { method = "GET", cookie = "", body = null, headers = {} } = {}) {
  const reqHeaders = { ...headers };
  if (cookie) reqHeaders.Cookie = cookie;
  if (body !== null) reqHeaders["Content-Type"] = "application/json";
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: reqHeaders,
    body: body !== null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // HTML or CSV response
  }
  return { status: res.status, headers: res.headers, text, json };
}

test("Unit: numberToWords boundary cases (0, 999, 100000, 10000000)", () => {
  assert.equal(numberToWords(0), "Zero Rupees Only");
  assert.equal(numberToWords(999), "Rupees Nine Hundred Ninety Nine Only");
  assert.equal(numberToWords(100000), "Rupees One Lakh Only");
  assert.equal(numberToWords(10000000), "Rupees One Crore Only");
});

test("Unit: integer paisa precision avoids floating-point drift", () => {
  const toPaisa = (n) => Math.round(Number(n) * 100);
  const fromPaisa = (p) => Math.round(p) / 100;
  assert.equal(fromPaisa(toPaisa(0.1) + toPaisa(0.2)), 0.3);
  assert.equal(fromPaisa(toPaisa(3800) - Math.round((toPaisa(3800) * 20) / 100)), 3040);
  assert.equal(fromPaisa(toPaisa(3800) - Math.round((toPaisa(3800) * 50) / 100)), 1900);
});

test("Full Fee System Security, Immutability & Fool-Proof Integration Suite", async () => {
  await waitForServer();

  const tempUserIds = [];
  let createdChallanId = null;
  let originalClassFeeBackup = null;
  const syntheticMonth = `VerifyRun ${Date.now()}`;

  try {
    // ------------------------------------------------------------------
    // 1. Seed temporary Accountant and Registrar users for 403 testing
    // ------------------------------------------------------------------
    const tempHash = await bcrypt.hash("TempPass@123", 10);
    const [accountantRole, registrarRole] = await Promise.all([
      prisma.roles.findFirstOrThrow({ where: { name: "Accountant" } }),
      prisma.roles.findFirstOrThrow({ where: { name: "Registrar" } }),
    ]);

    const accountantUser = await prisma.users.create({
      data: {
        name: "QA Accountant",
        email: `qa-accountant-${Date.now()}@sm.local`,
        password: tempHash,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    tempUserIds.push(accountantUser.id);
    await prisma.model_has_roles.create({
      data: {
        role_id: accountantRole.id,
        model_type: "App\\Models\\User",
        model_id: accountantUser.id,
      },
    });

    const registrarUser = await prisma.users.create({
      data: {
        name: "QA Registrar",
        email: `qa-registrar-${Date.now()}@sm.local`,
        password: tempHash,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    tempUserIds.push(registrarUser.id);
    await prisma.model_has_roles.create({
      data: {
        role_id: registrarRole.id,
        model_type: "App\\Models\\User",
        model_id: registrarUser.id,
      },
    });

    const adminLogin = await loginAs("Admin", "Admin@12345", "10.0.0.10");
    assert.equal(adminLogin.status, 200, "Admin login should succeed");
    const adminCookie = adminLogin.cookie;
    assert.ok(adminCookie, "Admin session cookie must be issued");

    const accLogin = await loginAs(accountantUser.email, "TempPass@123", "10.0.0.11");
    assert.equal(accLogin.status, 200, "Accountant login should succeed");
    const accCookie = accLogin.cookie;

    const regLogin = await loginAs(registrarUser.email, "TempPass@123", "10.0.0.12");
    assert.equal(regLogin.status, 200, "Registrar login should succeed");
    const regCookie = regLogin.cookie;

    // ------------------------------------------------------------------
    // 2. Fee Types catalog check (MONTHLY, EXAM, PROMOTION, BOOKS)
    // ------------------------------------------------------------------
    const ftRes = await apiFetch("/api/admin/fee-types", { cookie: adminCookie });
    assert.equal(ftRes.status, 200);
    const codes = (ftRes.json?.feeTypes ?? []).map((x) => x.code);
    for (const reqCode of ["MONTHLY", "EXAM", "PROMOTION", "BOOKS"]) {
      assert.ok(codes.includes(reqCode), `Fee type ${reqCode} must exist`);
    }

    // Load matrix to grab a real class & session
    const matrixRes = await apiFetch("/api/admin/fee-amounts", { cookie: adminCookie });
    assert.equal(matrixRes.status, 200);
    assert.equal(matrixRes.json.canEdit, true, "Admin must have canEdit=true");

    const accMatrixRes = await apiFetch("/api/admin/fee-amounts", { cookie: accCookie });
    assert.equal(accMatrixRes.status, 200);
    assert.equal(accMatrixRes.json.canEdit, false, "Accountant must have canEdit=false");

    const targetClass = matrixRes.json.classes[0];
    const targetSession = matrixRes.json.selectedSession;
    const booksType = matrixRes.json.feeTypes.find((f) => f.code === "BOOKS");
    const existingBooksRow = matrixRes.json.amounts.find(
      (a) => a.school_class_id === targetClass.id && a.fee_type_id === booksType.id,
    );
    originalClassFeeBackup = {
      school_class_id: targetClass.id,
      academic_session_id: targetSession.id,
      fee_type_id: booksType.id,
      amount: existingBooksRow ? Number(existingBooksRow.amount) : 1500,
    };

    // ------------------------------------------------------------------
    // 3. Role-Based Authorization: Non-Admin gets 403 on ALL admin-only fee actions
    // ------------------------------------------------------------------
    for (const [roleName, cookie] of [
      ["Accountant", accCookie],
      ["Registrar", regCookie],
    ]) {
      const r1 = await apiFetch("/api/admin/fee-amounts", {
        method: "PUT",
        cookie,
        body: {
          school_class_id: targetClass.id,
          academic_session_id: targetSession.id,
          fee_type_id: booksType.id,
          amount: 9999,
        },
      });
      assert.equal(r1.status, 403, `${roleName} PUT /fee-amounts must be 403`);

      const r2 = await apiFetch("/api/admin/fee-structures", {
        method: "POST",
        cookie,
        body: { school_class_id: targetClass.id, tuition_fee: 9999 },
      });
      assert.equal(r2.status, 403, `${roleName} POST /fee-structures must be 403`);

      const r3 = await apiFetch("/api/admin/fees/reverse", {
        method: "POST",
        cookie,
        body: { paymentId: 1, reason: "Unauthorized attempt test" },
      });
      assert.equal(r3.status, 403, `${roleName} POST /fees/reverse must be 403`);

      const r4 = await apiFetch("/api/admin/fee-audit", { cookie });
      assert.equal(r4.status, 403, `${roleName} GET /fee-audit must be 403`);

      const r5 = await apiFetch("/api/admin/fees", {
        method: "POST",
        cookie,
        body: { action: "apply-late-fines" },
      });
      assert.equal(r5.status, 403, `${roleName} apply-late-fines must be 403`);
    }

    // Registrar also cannot generate challans or collect payments
    const regGen = await apiFetch("/api/admin/fees", {
      method: "POST",
      cookie: regCookie,
      body: { action: "generate-roll", billingMonth: syntheticMonth },
    });
    assert.equal(regGen.status, 403, "Registrar cannot generate challans");

    // Verify denied attempts were logged in fee_audit_logs
    const deniedCount = await prisma.fee_audit_logs.count({
      where: {
        action: "LOGIN_DENIED_FEE_EDIT",
        user_id: { in: tempUserIds },
      },
    });
    assert.ok(deniedCount >= 5, `Denied attempts must be logged (found ${deniedCount})`);

    // ------------------------------------------------------------------
    // 4. Administrator edits fee amount -> 200 + FEE_AMOUNT_CHANGED audit row
    // ------------------------------------------------------------------
    const newTestAmount = originalClassFeeBackup.amount + 250;
    const adminEdit = await apiFetch("/api/admin/fee-amounts", {
      method: "PUT",
      cookie: adminCookie,
      body: {
        school_class_id: targetClass.id,
        academic_session_id: targetSession.id,
        fee_type_id: booksType.id,
        amount: newTestAmount,
        reason: "QA automated verification edit",
      },
    });
    assert.equal(adminEdit.status, 200, "Admin PUT /fee-amounts must return 200");
    assert.equal(Number(adminEdit.json.record.amount), newTestAmount);

    const changeLog = await prisma.fee_audit_logs.findFirst({
      where: {
        action: "FEE_AMOUNT_CHANGED",
        entity_type: "class_fee_amount",
        entity_id: BigInt(adminEdit.json.record.id),
      },
      orderBy: { id: "desc" },
    });
    assert.ok(changeLog, "FEE_AMOUNT_CHANGED audit log must exist");
    assert.equal(Number(changeLog.new_values?.amount), newTestAmount);

    // ------------------------------------------------------------------
    // 5. DB Immutability Trigger on fee_audit_logs (UPDATE & DELETE blocked)
    // ------------------------------------------------------------------
    await assert.rejects(
      () =>
        prisma.$executeRawUnsafe(
          `UPDATE fee_audit_logs SET reason = 'tampered' WHERE id = $1`,
          changeLog.id,
        ),
      /append-only|forbidden|immutable/i,
      "DB trigger must reject UPDATE on fee_audit_logs",
    );

    await assert.rejects(
      () =>
        prisma.$executeRawUnsafe(
          `DELETE FROM fee_audit_logs WHERE id = $1`,
          changeLog.id,
        ),
      /append-only|forbidden|immutable/i,
      "DB trigger must reject DELETE on fee_audit_logs",
    );

    // ------------------------------------------------------------------
    // 6. Generate single family challan with MONTHLY + EXAM + BOOKS + PROMOTION
    //    Check sibling discount on MONTHLY only, and idempotency on re-generation
    // ------------------------------------------------------------------
    // Prefer a family with 2+ active students to verify sibling discount!
    const activeFamilies = await prisma.families.findMany({
      where: { is_active: true, deleted_at: null },
      include: {
        students: { where: { status: "active", deleted_at: null } },
      },
      take: 30,
    });
    const testFamily =
      activeFamilies.find((f) => f.students.length >= 2) ||
      activeFamilies.find((f) => f.students.length >= 1);
    assert.ok(testFamily, "Database must have at least one active family with active student");

    const genRes = await apiFetch("/api/admin/fees", {
      method: "POST",
      cookie: adminCookie,
      body: {
        action: "generate-single",
        familyId: Number(testFamily.id),
        billingMonth: syntheticMonth,
        sessionId: targetSession.id,
        includeMonthly: true,
        includeExam: true,
        examTerm: "QA-MidTerm",
        includeBooks: true,
        includePromotion: true,
      },
    });
    assert.equal(genRes.status, 201, `Challan generation should succeed: ${genRes.text}`);
    const challan = genRes.json.challan;
    createdChallanId = BigInt(challan.id);

    // Verify no non-MONTHLY fee received sibling concession
    for (const sf of challan.student_fees) {
      if (sf.fee_types?.code && sf.fee_types.code !== "MONTHLY") {
        assert.equal(
          Number(sf.concession_amount),
          0,
          `Sibling discount must NOT apply to ${sf.fee_types.code}`,
        );
      }
    }

    // Regenerate the exact same challan -> Books & Promotion must NOT duplicate!
    const countBeforeRegen = challan.student_fees.length;
    const regenRes = await apiFetch("/api/admin/fees", {
      method: "POST",
      cookie: adminCookie,
      body: {
        action: "generate-single",
        familyId: Number(testFamily.id),
        billingMonth: syntheticMonth,
        sessionId: targetSession.id,
        includeMonthly: true,
        includeExam: true,
        examTerm: "QA-MidTerm",
        includeBooks: true,
        includePromotion: true,
      },
    });
    assert.equal(regenRes.status, 201);
    assert.equal(
      regenRes.json.challan.student_fees.length,
      countBeforeRegen,
      "Regenerating must not duplicate Exam/Books/Promotion rows",
    );

    const totalPayable = Number(regenRes.json.challan.payable_before_due);
    assert.ok(totalPayable > 0, "Generated challan payable must be > 0");

    // ------------------------------------------------------------------
    // 7. Payment Fool-Proofing: Zero, Overpayment, Non-cash without ref, Idempotency
    // ------------------------------------------------------------------
    const zeroPay = await apiFetch("/api/admin/fees", {
      method: "POST",
      cookie: accCookie,
      body: {
        action: "collect-payment",
        challanId: Number(createdChallanId),
        amountPaid: 0,
        paymentMethod: "Cash",
        idempotencyKey: crypto.randomUUID(),
      },
    });
    assert.equal(zeroPay.status, 422, "Zero payment must return 422");

    const overPay = await apiFetch("/api/admin/fees", {
      method: "POST",
      cookie: accCookie,
      body: {
        action: "collect-payment",
        challanId: Number(createdChallanId),
        amountPaid: totalPayable + 500,
        paymentMethod: "Cash",
        idempotencyKey: crypto.randomUUID(),
      },
    });
    assert.equal(overPay.status, 422, "Overpayment must be blocked with 422");

    const noRefPay = await apiFetch("/api/admin/fees", {
      method: "POST",
      cookie: accCookie,
      body: {
        action: "collect-payment",
        challanId: Number(createdChallanId),
        amountPaid: 100,
        paymentMethod: "JazzCash",
        reference: "",
        idempotencyKey: crypto.randomUUID(),
      },
    });
    assert.equal(noRefPay.status, 422, "Non-cash payment without reference must return 422");

    // Valid partial payment by Accountant with Idempotency Key
    const partialAmount = Math.min(500, Math.floor(totalPayable / 2));
    const idemKey = crypto.randomUUID();
    const pay1 = await apiFetch("/api/admin/fees", {
      method: "POST",
      cookie: accCookie,
      body: {
        action: "collect-payment",
        challanId: Number(createdChallanId),
        amountPaid: partialAmount,
        paymentMethod: "Bank Deposit",
        reference: "HBL-QA-778899",
        idempotencyKey: idemKey,
      },
    });
    assert.equal(pay1.status, 200, `Partial payment should succeed: ${pay1.text}`);
    assert.equal(pay1.json.duplicate, false);
    const receipt1 = pay1.json.payment.receipt_no;
    assert.match(receipt1, /^REC-\d{6}-\d{5}$/, "Receipt must match sequence format");

    // Replay same idempotencyKey -> returns identical receipt, NO second payment!
    const pay1Dup = await apiFetch("/api/admin/fees", {
      method: "POST",
      cookie: accCookie,
      body: {
        action: "collect-payment",
        challanId: Number(createdChallanId),
        amountPaid: partialAmount,
        paymentMethod: "Bank Deposit",
        reference: "HBL-QA-778899",
        idempotencyKey: idemKey,
      },
    });
    assert.equal(pay1Dup.status, 200);
    assert.equal(pay1Dup.json.duplicate, true);
    assert.equal(pay1Dup.json.payment.receipt_no, receipt1);

    const paymentCountAfterDup = await prisma.fee_payments.count({
      where: { family_fee_challan_id: createdChallanId },
    });
    assert.equal(paymentCountAfterDup, 1, "Idempotency key must keep exactly 1 payment row");

    // Regenerating challan after partial payment MUST preserve paid_amount!
    const regenAfterPay = await apiFetch("/api/admin/fees", {
      method: "POST",
      cookie: adminCookie,
      body: {
        action: "generate-single",
        familyId: Number(testFamily.id),
        billingMonth: syntheticMonth,
        sessionId: targetSession.id,
        includeMonthly: true,
      },
    });
    assert.equal(regenAfterPay.status, 201);
    assert.equal(
      Number(regenAfterPay.json.challan.paid_amount),
      partialAmount,
      "Regenerating challan must NEVER reduce paid_amount",
    );

    // ------------------------------------------------------------------
    // 8. Parallel Race Condition Test: two simultaneous 60%-of-remaining payments
    // ------------------------------------------------------------------
    const remainingNow = totalPayable - partialAmount;
    const sixtyPct = Math.ceil(remainingNow * 0.6);
    const [raceA, raceB] = await Promise.all([
      apiFetch("/api/admin/fees", {
        method: "POST",
        cookie: adminCookie,
        body: {
          action: "collect-payment",
          challanId: Number(createdChallanId),
          amountPaid: sixtyPct,
          paymentMethod: "Cash",
          idempotencyKey: crypto.randomUUID(),
        },
      }),
      apiFetch("/api/admin/fees", {
        method: "POST",
        cookie: adminCookie,
        body: {
          action: "collect-payment",
          challanId: Number(createdChallanId),
          amountPaid: sixtyPct,
          paymentMethod: "Cash",
          idempotencyKey: crypto.randomUUID(),
        },
      }),
    ]);
    const succeededRaces = [raceA, raceB].filter((r) => r.status === 200).length;
    assert.ok(succeededRaces <= 1, "At most one of two conflicting 60% parallel payments can succeed");
    const nonOkRaces = [raceA, raceB].filter((r) => r.status !== 200);
    for (const r of nonOkRaces) {
      assert.ok(
        r.status === 409 || r.status === 422,
        `Rejected parallel payment should return 409 or 422 (got ${r.status})`,
      );
    }

    const refreshedChallan = await prisma.family_fee_challans.findUniqueOrThrow({
      where: { id: createdChallanId },
    });
    assert.ok(
      Number(refreshedChallan.paid_amount) <= Number(refreshedChallan.payable_before_due),
      "Total paid_amount must NEVER exceed payable_before_due under parallel load",
    );

    // ------------------------------------------------------------------
    // 9. Administrator Payment Reversal & Printable Receipt with REVERSED Watermark
    // ------------------------------------------------------------------
    const shortReasonRev = await apiFetch("/api/admin/fees/reverse", {
      method: "POST",
      cookie: adminCookie,
      body: { paymentId: pay1.json.payment.id, reason: "short" },
    });
    assert.equal(shortReasonRev.status, 422, "Reversal reason < 10 chars must return 422");

    const validRev = await apiFetch("/api/admin/fees/reverse", {
      method: "POST",
      cookie: adminCookie,
      body: {
        paymentId: pay1.json.payment.id,
        reason: "QA automated verification reversal of test deposit",
      },
    });
    assert.equal(validRev.status, 200, `Valid reversal should return 200: ${validRev.text}`);
    assert.equal(validRev.json.payment.status, "reversed");

    // Receipt page renders 200 and includes REVERSED watermark + reason
    const receiptPage = await apiFetch(`/print/receipt/${pay1.json.payment.id}`, {
      cookie: adminCookie,
    });
    assert.equal(receiptPage.status, 200, "Receipt print page must return 200");
    assert.ok(receiptPage.text.includes(receipt1), "Receipt HTML must contain receipt number");
    assert.ok(receiptPage.text.includes("REVERSED"), "Reversed receipt must contain REVERSED watermark");
    assert.ok(
      receiptPage.text.includes("QA automated verification reversal"),
      "Reversed receipt must display reversal reason",
    );

    // ------------------------------------------------------------------
    // 10. Audit CSV export, Late Fine Cron Auth, & Login Rate Limiting
    // ------------------------------------------------------------------
    const auditCsv = await apiFetch("/api/admin/fee-audit?format=csv", {
      cookie: adminCookie,
    });
    assert.equal(auditCsv.status, 200);
    assert.ok(
      (auditCsv.headers.get("content-type") || "").includes("text/csv"),
      "Audit CSV export must return text/csv",
    );

    const cronNoSecret = await apiFetch("/api/cron/late-fines");
    assert.equal(cronNoSecret.status, 401, "Cron without secret must be 401");

    const cronWithSecret = await apiFetch("/api/cron/late-fines", {
      headers: { "x-cron-secret": CRON_SECRET },
    });
    assert.equal(cronWithSecret.status, 200, "Cron with valid secret must be 200");

    // Rate-limit test on isolated spoofed IP so real client IP is unaffected
    const testRateIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
    let hit429 = false;
    for (let i = 0; i < 6; i++) {
      const attempt = await loginAs("Admin", "WrongPassword!", testRateIp);
      if (attempt.status === 429) {
        hit429 = true;
        break;
      }
    }
    assert.ok(hit429, "Login route must rate-limit repeated failed attempts with 429");
  } finally {
    // Restore original class_fee_amounts value cleanly
    if (originalClassFeeBackup) {
      await prisma.class_fee_amounts
        .update({
          where: {
            school_class_id_academic_session_id_fee_type_id: {
              school_class_id: BigInt(originalClassFeeBackup.school_class_id),
              academic_session_id: BigInt(originalClassFeeBackup.academic_session_id),
              fee_type_id: BigInt(originalClassFeeBackup.fee_type_id),
            },
          },
          data: { amount: originalClassFeeBackup.amount, updated_at: new Date() },
        })
        .catch(() => {});
    }

    // Delete synthetic test challan (cascades payments; delete attached student_fees too)
    if (createdChallanId) {
      await prisma.fee_payments
        .deleteMany({ where: { family_fee_challan_id: createdChallanId } })
        .catch(() => {});
      await prisma.student_fees
        .deleteMany({ where: { family_fee_challan_id: createdChallanId } })
        .catch(() => {});
      await prisma.family_fee_challans
        .delete({ where: { id: createdChallanId } })
        .catch(() => {});
    }

    // Clean up temporary users so ONLY Admin remains in users table
    if (tempUserIds.length > 0) {
      await prisma.model_has_roles
        .deleteMany({ where: { model_id: { in: tempUserIds } } })
        .catch(() => {});
      await prisma.users
        .deleteMany({ where: { id: { in: tempUserIds } } })
        .catch(() => {});
    }

    await prisma.$disconnect();
  }
});

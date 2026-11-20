import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logFeeAudit } from "@/lib/audit";

export class FeeValidationError extends Error {
  status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.name = "FeeValidationError";
    this.status = status;
  }
}

export function toPaisa(amount: number | string | Prisma.Decimal | null | undefined): number {
  const num = Number(amount ?? 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function fromPaisa(paisa: number): number {
  return Math.round(paisa) / 100;
}

export function getStandardTuition(sortOrder?: number | null): number {
  const order = sortOrder ?? 0;
  if (order <= 2) return 3200;
  if (order <= 5) return 3800;
  if (order <= 8) return 4500;
  return 5500;
}

function parseMonthCode(billingMonth: string, fallback: Date): string {
  const parsed = new Date(`01 ${billingMonth}`);
  const dt = Number.isNaN(parsed.getTime()) ? fallback : parsed;
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
}

export interface BillingRunOptions {
  includeMonthly?: boolean;
  includeExam?: boolean;
  examTerm?: string | null;
  includeBooks?: boolean;
  includePromotion?: boolean;
}

export interface ActorInfo {
  id?: number | bigint | null;
  name: string;
  ipAddress?: string | null;
}

/**
 * Generates or updates a Master Family Fee Challan using integer paisa math,
 * per-class fee_types amounts (MONTHLY, EXAM, PROMOTION, BOOKS),
 * sibling concession ONLY on MONTHLY tuition, and dedup guards.
 */
export async function generateFamilyChallan(params: {
  familyId: bigint;
  billingMonth: string;
  dueDate: Date;
  issueDate?: Date;
  sessionId?: bigint | null;
  options?: BillingRunOptions;
  actor?: ActorInfo | null;
}) {
  const issueDate = params.issueDate ?? new Date();
  const opts: Required<BillingRunOptions> = {
    includeMonthly: params.options?.includeMonthly ?? true,
    includeExam: params.options?.includeExam ?? false,
    examTerm: params.options?.examTerm?.trim() || "Term",
    includeBooks: params.options?.includeBooks ?? false,
    includePromotion: params.options?.includePromotion ?? false,
  };

  let sessionId = params.sessionId ?? null;
  if (!sessionId) {
    const current =
      (await prisma.academic_sessions.findFirst({
        where: { is_current: true, deleted_at: null },
      })) ??
      (await prisma.academic_sessions.findFirst({
        where: { deleted_at: null },
        orderBy: { id: "asc" },
      }));
    sessionId = current?.id ?? null;
  }

  return prisma.$transaction(async (tx) => {
    const family = await tx.families.findUniqueOrThrow({
      where: { id: params.familyId },
    });

    const feeTypes = await tx.fee_types.findMany({
      where: { is_active: true },
    });
    const feeTypeByCode = new Map(feeTypes.map((ft) => [ft.code, ft]));
    const monthlyType = feeTypeByCode.get("MONTHLY");
    const examType = feeTypeByCode.get("EXAM");
    const booksType = feeTypeByCode.get("BOOKS");
    const promotionType = feeTypeByCode.get("PROMOTION");

    const activeStudents = await tx.students.findMany({
      where: {
        family_id: family.id,
        status: "active",
        deleted_at: null,
      },
      orderBy: [{ admission_date: "asc" }, { dob: "asc" }],
      include: {
        student_enrollments: {
          where: { deleted_at: null },
          orderBy: { id: "desc" },
          take: 1,
          include: { school_classes: true, class_sections: true },
        },
      },
    });

    const existingChallan = await tx.family_fee_challans.findFirst({
      where: {
        family_id: family.id,
        billing_month: params.billingMonth,
        deleted_at: null,
      },
    });

    const monthCode = parseMonthCode(params.billingMonth, issueDate);
    const paddedFamily = String(family.family_number).padStart(4, "0");
    const baseChallanNo = `CHL-${monthCode}-F${paddedFamily}`;

    let challanNo = existingChallan?.challan_no ?? baseChallanNo;
    if (!existingChallan) {
      let counter = 1;
      while (await tx.family_fee_challans.findFirst({ where: { challan_no: challanNo } })) {
        challanNo = `${baseChallanNo}-${counter++}`;
      }
    }

    const now = new Date();
    const familyChallan = existingChallan
      ? await tx.family_fee_challans.update({
          where: { id: existingChallan.id },
          data: {
            academic_session_id: sessionId,
            issue_date: issueDate,
            due_date: params.dueDate,
            updated_at: now,
          },
        })
      : await tx.family_fee_challans.create({
          data: {
            challan_no: challanNo,
            family_id: family.id,
            academic_session_id: sessionId,
            billing_month: params.billingMonth,
            issue_date: issueDate,
            due_date: params.dueDate,
            created_at: now,
            updated_at: now,
          },
        });

    // Helper to look up configured per-class amount for a fee type
    async function getClassFeePaisa(
      classId: bigint | null,
      code: string,
      sortOrder?: number | null,
    ): Promise<number> {
      const ft = feeTypeByCode.get(code);
      if (classId && sessionId && ft) {
        const row = await tx.class_fee_amounts.findUnique({
          where: {
            school_class_id_academic_session_id_fee_type_id: {
              school_class_id: classId,
              academic_session_id: sessionId,
              fee_type_id: ft.id,
            },
          },
        });
        if (row) return toPaisa(row.amount);
      }
      // Fallback for MONTHLY from class_fee_structures or standard defaults
      if (code === "MONTHLY") {
        if (classId && sessionId) {
          const legacy = await tx.class_fee_structures.findFirst({
            where: {
              school_class_id: classId,
              academic_session_id: sessionId,
              deleted_at: null,
            },
          });
          if (legacy) return toPaisa(legacy.tuition_fee);
        }
        return toPaisa(classId ? getStandardTuition(sortOrder) : 3500);
      }
      return 0;
    }

    for (let i = 0; i < activeStudents.length; i++) {
      const student = activeStudents[i];
      const rank = i + 1;
      // Sibling concession policy: 1st = 0%, 2nd = 20%, 3rd+ = 50% — MONTHLY TUITION ONLY
      const discountPercent = rank === 1 ? 0 : rank === 2 ? 20 : 50;

      const latestEnrollment = student.student_enrollments[0] ?? null;
      const schoolClass = latestEnrollment?.school_classes ?? null;

      // Arrears from prior months
      const arrearsAgg = await tx.student_fees.aggregate({
        where: {
          student_id: student.id,
          billing_month: { not: params.billingMonth },
          status: { in: ["unpaid", "partial", "overdue"] },
          deleted_at: null,
        },
        _sum: { due_amount: true },
      });
      const arrearsPaisa = toPaisa(arrearsAgg._sum.due_amount);

      // 1. MONTHLY FEE LINE ITEM
      if (opts.includeMonthly && monthlyType) {
        const monthlyPaisa = await getClassFeePaisa(
          schoolClass?.id ?? null,
          "MONTHLY",
          schoolClass?.sort_order,
        );
        const siblingDiscountPaisa = Math.round((monthlyPaisa * discountPercent) / 100);
        const netPayablePaisa = monthlyPaisa - siblingDiscountPaisa + arrearsPaisa;
        const billingKey = `MONTHLY:${params.billingMonth}`;

        const existingMonthly = await tx.student_fees.findFirst({
          where: {
            student_id: student.id,
            billing_month: params.billingMonth,
            deleted_at: null,
            OR: [{ fee_type_id: monthlyType.id }, { fee_type_id: null }],
          },
        });

        const baseStuChallan = `${familyChallan.challan_no}-S${student.id}`;
        let stuChallanNo = existingMonthly?.challan_no ?? baseStuChallan;
        if (!existingMonthly) {
          let sc = 1;
          while (await tx.student_fees.findFirst({ where: { challan_no: stuChallanNo } })) {
            stuChallanNo = `${baseStuChallan}-${sc++}`;
          }
        }

        const alreadyPaidPaisa = existingMonthly
          ? toPaisa(existingMonthly.paid_amount)
          : 0;
        const duePaisa = Math.max(0, netPayablePaisa - alreadyPaidPaisa);
        const status =
          alreadyPaidPaisa >= netPayablePaisa
            ? "paid"
            : alreadyPaidPaisa > 0
              ? "partial"
              : "unpaid";

        if (existingMonthly) {
          await tx.student_fees.update({
            where: { id: existingMonthly.id },
            data: {
              family_fee_challan_id: familyChallan.id,
              academic_session_id: sessionId,
              fee_type_id: monthlyType.id,
              student_enrollment_id: latestEnrollment?.id ?? null,
              billing_key: billingKey,
              fee_type:
                discountPercent > 0
                  ? `Monthly Tuition (${discountPercent}% Sibling Disc.)`
                  : "Monthly Tuition",
              amount: fromPaisa(monthlyPaisa),
              concession_amount: fromPaisa(siblingDiscountPaisa),
              arrears_amount: fromPaisa(arrearsPaisa),
              late_fine: 200,
              net_payable: fromPaisa(netPayablePaisa),
              due_amount: fromPaisa(duePaisa),
              due_date: params.dueDate,
              status,
              updated_at: now,
            },
          });
        } else {
          await tx.student_fees.create({
            data: {
              student_id: student.id,
              family_fee_challan_id: familyChallan.id,
              academic_session_id: sessionId,
              fee_type_id: monthlyType.id,
              student_enrollment_id: latestEnrollment?.id ?? null,
              billing_key: billingKey,
              challan_no: stuChallanNo,
              fee_type:
                discountPercent > 0
                  ? `Monthly Tuition (${discountPercent}% Sibling Disc.)`
                  : "Monthly Tuition",
              billing_month: params.billingMonth,
              amount: fromPaisa(monthlyPaisa),
              concession_amount: fromPaisa(siblingDiscountPaisa),
              arrears_amount: fromPaisa(arrearsPaisa),
              late_fine: 200,
              net_payable: fromPaisa(netPayablePaisa),
              paid_amount: 0,
              due_amount: fromPaisa(netPayablePaisa),
              due_date: params.dueDate,
              status: "unpaid",
              created_at: now,
              updated_at: now,
            },
          });
        }
      }

      // 2. EXAM FEE (per term, no sibling discount, deduped by term in session)
      if (opts.includeExam && examType) {
        const examPaisa = await getClassFeePaisa(schoolClass?.id ?? null, "EXAM");
        const examKey = `EXAM:${opts.examTerm}:${sessionId ?? 0}`;
        if (examPaisa > 0) {
          const alreadyBilled = await tx.student_fees.findFirst({
            where: {
              student_id: student.id,
              academic_session_id: sessionId,
              fee_type_id: examType.id,
              billing_key: examKey,
              deleted_at: null,
            },
          });
          if (!alreadyBilled) {
            await createOneOffFeeItem(tx, {
              studentId: student.id,
              familyChallanId: familyChallan.id,
              sessionId,
              feeTypeId: examType.id,
              enrollmentId: latestEnrollment?.id ?? null,
              billingKey: examKey,
              challanPrefix: `${familyChallan.challan_no}-EX-S${student.id}`,
              label: `Examination Fee (${opts.examTerm})`,
              billingMonth: params.billingMonth,
              amountPaisa: examPaisa,
              dueDate: params.dueDate,
              now,
            });
          }
        }
      }

      // 3. BOOKS FEE (strictly ONCE per student per session!)
      if (opts.includeBooks && booksType) {
        const booksPaisa = await getClassFeePaisa(schoolClass?.id ?? null, "BOOKS");
        const booksKey = `BOOKS:${sessionId ?? 0}`;
        if (booksPaisa > 0) {
          const alreadyBilled = await tx.student_fees.findFirst({
            where: {
              student_id: student.id,
              academic_session_id: sessionId,
              fee_type_id: booksType.id,
              deleted_at: null,
            },
          });
          if (!alreadyBilled) {
            await createOneOffFeeItem(tx, {
              studentId: student.id,
              familyChallanId: familyChallan.id,
              sessionId,
              feeTypeId: booksType.id,
              enrollmentId: latestEnrollment?.id ?? null,
              billingKey: booksKey,
              challanPrefix: `${familyChallan.challan_no}-BK-S${student.id}`,
              label: "Books & Stationery Fee",
              billingMonth: params.billingMonth,
              amountPaisa: booksPaisa,
              dueDate: params.dueDate,
              now,
            });
          }
        }
      }

      // 4. PROMOTION FEE (strictly ONCE per student per session!)
      if (opts.includePromotion && promotionType) {
        const promoPaisa = await getClassFeePaisa(schoolClass?.id ?? null, "PROMOTION");
        const promoKey = `PROMOTION:${sessionId ?? 0}`;
        if (promoPaisa > 0) {
          const alreadyBilled = await tx.student_fees.findFirst({
            where: {
              student_id: student.id,
              academic_session_id: sessionId,
              fee_type_id: promotionType.id,
              deleted_at: null,
            },
          });
          if (!alreadyBilled) {
            await createOneOffFeeItem(tx, {
              studentId: student.id,
              familyChallanId: familyChallan.id,
              sessionId,
              feeTypeId: promotionType.id,
              enrollmentId: latestEnrollment?.id ?? null,
              billingKey: promoKey,
              challanPrefix: `${familyChallan.challan_no}-PR-S${student.id}`,
              label: "Class Promotion Fee",
              billingMonth: params.billingMonth,
              amountPaisa: promoPaisa,
              dueDate: params.dueDate,
              now,
            });
          }
        }
      }
    }

    // Recompute master challan totals from ALL attached student_fees rows (never drops paid_amount!)
    const allItems = await tx.student_fees.findMany({
      where: { family_fee_challan_id: familyChallan.id, deleted_at: null },
    });

    const totalGrossPaisa = allItems.reduce((s, x) => s + toPaisa(x.amount), 0);
    const totalConcessionPaisa = allItems.reduce(
      (s, x) => s + toPaisa(x.concession_amount),
      0,
    );
    const totalArrearsPaisa = allItems.reduce((s, x) => s + toPaisa(x.arrears_amount), 0);
    const payableBeforePaisa = totalGrossPaisa - totalConcessionPaisa + totalArrearsPaisa;
    const lateFinePaisa = 25000; // Rs. 250.00
    const payableAfterPaisa = payableBeforePaisa + lateFinePaisa;

    const existingPaidPaisa = toPaisa(familyChallan.paid_amount);
    const effectivePayablePaisa = familyChallan.late_fine_applied_at
      ? payableAfterPaisa
      : payableBeforePaisa;

    const status =
      existingPaidPaisa >= effectivePayablePaisa && effectivePayablePaisa > 0
        ? "paid"
        : existingPaidPaisa > 0
          ? "partial"
          : "unpaid";

    const updatedChallan = await tx.family_fee_challans.update({
      where: { id: familyChallan.id },
      data: {
        total_gross: fromPaisa(totalGrossPaisa),
        total_concession: fromPaisa(totalConcessionPaisa),
        total_arrears: fromPaisa(totalArrearsPaisa),
        late_fine: fromPaisa(lateFinePaisa),
        payable_before_due: fromPaisa(effectivePayablePaisa),
        payable_after_due: fromPaisa(payableAfterPaisa),
        status,
        updated_at: now,
      },
      include: {
        families: true,
        student_fees: { include: { students: true, fee_types: true } },
      },
    });

    if (params.actor) {
      await logFeeAudit(
        {
          userId: params.actor.id,
          userName: params.actor.name,
          action: "CHALLAN_GENERATED",
          entityType: "family_fee_challan",
          entityId: updatedChallan.id,
          newValues: {
            challan_no: updatedChallan.challan_no,
            billing_month: params.billingMonth,
            payable_before_due: Number(updatedChallan.payable_before_due),
            options: opts,
          },
          ipAddress: params.actor.ipAddress ?? null,
        },
        tx,
      );
    }

    return updatedChallan;
  });
}

async function createOneOffFeeItem(
  tx: Prisma.TransactionClient,
  args: {
    studentId: bigint;
    familyChallanId: bigint;
    sessionId: bigint | null;
    feeTypeId: bigint;
    enrollmentId: bigint | null;
    billingKey: string;
    challanPrefix: string;
    label: string;
    billingMonth: string;
    amountPaisa: number;
    dueDate: Date;
    now: Date;
  },
) {
  let challanNo = args.challanPrefix;
  let counter = 1;
  while (await tx.student_fees.findFirst({ where: { challan_no: challanNo } })) {
    challanNo = `${args.challanPrefix}-${counter++}`;
  }

  return tx.student_fees.create({
    data: {
      student_id: args.studentId,
      family_fee_challan_id: args.familyChallanId,
      academic_session_id: args.sessionId,
      fee_type_id: args.feeTypeId,
      student_enrollment_id: args.enrollmentId,
      billing_key: args.billingKey,
      challan_no: challanNo,
      fee_type: args.label,
      billing_month: args.billingMonth,
      amount: fromPaisa(args.amountPaisa),
      concession_amount: 0,
      arrears_amount: 0,
      late_fine: 0,
      net_payable: fromPaisa(args.amountPaisa),
      paid_amount: 0,
      due_amount: fromPaisa(args.amountPaisa),
      due_date: args.dueDate,
      status: "unpaid",
      created_at: args.now,
      updated_at: args.now,
    },
  });
}

export async function generateMonthlyRoll(
  billingMonth: string,
  sessionId?: bigint | null,
  options?: BillingRunOptions,
  actor?: ActorInfo | null,
) {
  const families = await prisma.families.findMany({
    where: {
      is_active: true,
      deleted_at: null,
      students: { some: { status: "active", deleted_at: null } },
    },
    select: { id: true },
  });

  const issueDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 10);

  let count = 0;
  for (const fam of families) {
    await generateFamilyChallan({
      familyId: fam.id,
      billingMonth,
      dueDate,
      issueDate,
      sessionId,
      options,
      actor,
    });
    count++;
  }
  return count;
}

/**
 * Automatically charges one PROMOTION fee when a student is enrolled in a new
 * academic session with a higher class sort_order than their prior enrollment.
 */
export async function chargePromotionFeeIfPromoted(params: {
  studentId: bigint;
  sessionId: bigint;
  newClassId: bigint;
  enrollmentId: bigint;
  actor?: ActorInfo | null;
}) {
  const promotionType = await prisma.fee_types.findUnique({
    where: { code: "PROMOTION" },
  });
  if (!promotionType) return null;

  // Check if student already had an earlier enrollment in a lower class
  const [newClass, priorEnrollments, existingPromo] = await Promise.all([
    prisma.school_classes.findUnique({ where: { id: params.newClassId } }),
    prisma.student_enrollments.findMany({
      where: {
        student_id: params.studentId,
        session_id: { not: params.sessionId },
        deleted_at: null,
      },
      include: { school_classes: true },
      orderBy: { id: "desc" },
      take: 1,
    }),
    prisma.student_fees.findFirst({
      where: {
        student_id: params.studentId,
        academic_session_id: params.sessionId,
        fee_type_id: promotionType.id,
        deleted_at: null,
      },
    }),
  ]);

  if (!newClass || existingPromo) return null;
  const previousClass = priorEnrollments[0]?.school_classes;
  if (!previousClass || newClass.sort_order <= previousClass.sort_order) {
    return null;
  }

  const feeRow = await prisma.class_fee_amounts.findUnique({
    where: {
      school_class_id_academic_session_id_fee_type_id: {
        school_class_id: params.newClassId,
        academic_session_id: params.sessionId,
        fee_type_id: promotionType.id,
      },
    },
  });
  const promoPaisa = toPaisa(feeRow?.amount ?? 500);
  if (promoPaisa <= 0) return null;

  const now = new Date();
  const billingMonth = now.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 10);

  let challanNo = `PROMO-${params.sessionId}-S${params.studentId}`;
  let c = 1;
  while (await prisma.student_fees.findFirst({ where: { challan_no: challanNo } })) {
    challanNo = `PROMO-${params.sessionId}-S${params.studentId}-${c++}`;
  }

  const created = await prisma.student_fees.create({
    data: {
      student_id: params.studentId,
      academic_session_id: params.sessionId,
      fee_type_id: promotionType.id,
      student_enrollment_id: params.enrollmentId,
      billing_key: `PROMOTION:${params.sessionId}`,
      challan_no: challanNo,
      fee_type: `Promotion Fee (${previousClass.name} → ${newClass.name})`,
      billing_month: billingMonth,
      amount: fromPaisa(promoPaisa),
      concession_amount: 0,
      arrears_amount: 0,
      late_fine: 0,
      net_payable: fromPaisa(promoPaisa),
      paid_amount: 0,
      due_amount: fromPaisa(promoPaisa),
      due_date: dueDate,
      status: "unpaid",
      created_at: now,
      updated_at: now,
    },
  });

  if (params.actor) {
    await logFeeAudit({
      userId: params.actor.id,
      userName: params.actor.name,
      action: "PROMOTION_FEE_CHARGED",
      entityType: "student_fee",
      entityId: created.id,
      newValues: {
        student_id: Number(params.studentId),
        from_class: previousClass.name,
        to_class: newClass.name,
        amount: fromPaisa(promoPaisa),
      },
      ipAddress: params.actor.ipAddress ?? null,
    });
  }

  return created;
}

/**
 * Fool-proof payment recorder:
 * - Serializable isolation + SELECT FOR UPDATE row lock
 * - Idempotency key prevents duplicate double-submit payments
 * - Rejects zero/negative, already-paid, overpayment, and non-cash without reference
 * - Sequence-backed collision-free receipt number (receipt_no_seq)
 * - Integer paisa allocation + immutable audit log
 */
export async function recordChallanPayment(params: {
  challanId: bigint;
  amountPaid: number;
  paymentMethod?: string;
  reference?: string | null;
  remarks?: string | null;
  idempotencyKey?: string | null;
  actor: ActorInfo;
}) {
  const amountPaisa = toPaisa(params.amountPaid);
  if (amountPaisa <= 0) {
    throw new FeeValidationError("Payment amount must be greater than zero.", 422);
  }

  const paymentMethod = (params.paymentMethod || "Cash").trim();
  const reference = params.reference?.trim() || null;
  if (paymentMethod !== "Cash" && !reference) {
    throw new FeeValidationError(
      `A transaction or deposit slip reference is required for ${paymentMethod} payments.`,
      422,
    );
  }

  const idempotencyKey = params.idempotencyKey?.trim() || null;

  try {
    return await prisma.$transaction(
      async (tx) => {
      // 1. Idempotency check BEFORE modifying anything
      if (idempotencyKey) {
        const existing = await tx.fee_payments.findFirst({
          where: { idempotency_key: idempotencyKey },
        });
        if (existing) {
          return { payment: existing, duplicate: true };
        }
      }

      // 2. Lock the challan row to prevent concurrent overpayments
      await tx.$queryRawUnsafe(
        `SELECT id FROM family_fee_challans WHERE id = $1 FOR UPDATE`,
        params.challanId,
      );

      const challan = await tx.family_fee_challans.findFirst({
        where: { id: params.challanId, deleted_at: null },
        include: {
          families: true,
          student_fees: {
            where: { deleted_at: null },
            orderBy: [{ due_date: "asc" }, { id: "asc" }],
          },
        },
      });

      if (!challan) {
        throw new FeeValidationError("Fee challan not found.", 404);
      }

      const payablePaisa = toPaisa(challan.payable_before_due);
      const alreadyPaidPaisa = toPaisa(challan.paid_amount);
      const remainingPaisa = Math.max(0, payablePaisa - alreadyPaidPaisa);

      if (challan.status === "paid" || remainingPaisa === 0) {
        throw new FeeValidationError("This challan is already fully paid.", 422);
      }

      if (amountPaisa > remainingPaisa) {
        throw new FeeValidationError(
          `Overpayment blocked: Rs. ${fromPaisa(amountPaisa).toLocaleString("en-PK")} exceeds remaining due of Rs. ${fromPaisa(remainingPaisa).toLocaleString("en-PK")}.`,
          422,
        );
      }

      // 3. Collision-free receipt number from PostgreSQL sequence
      const seqRows = await tx.$queryRawUnsafe<{ seq: bigint }[]>(
        `SELECT nextval('receipt_no_seq')::bigint AS seq`,
      );
      const seqNum = Number(seqRows[0]?.seq ?? 1);
      const now = new Date();
      const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
      const receiptNo = `REC-${ym}-${String(seqNum).padStart(5, "0")}`;

      const payment = await tx.fee_payments.create({
        data: {
          receipt_no: receiptNo,
          family_fee_challan_id: challan.id,
          amount_paid: fromPaisa(amountPaisa),
          payment_date: now,
          payment_method: paymentMethod,
          transaction_reference: reference,
          collected_by_user_id:
            params.actor.id != null ? BigInt(params.actor.id) : null,
          remarks: params.remarks?.trim() || null,
          idempotency_key: idempotencyKey,
          status: "posted",
          created_at: now,
          updated_at: now,
        },
      });

      const newTotalPaidPaisa = alreadyPaidPaisa + amountPaisa;
      const nextStatus =
        newTotalPaidPaisa >= payablePaisa
          ? "paid"
          : newTotalPaidPaisa > 0
            ? "partial"
            : challan.status;

      await tx.family_fee_challans.update({
        where: { id: challan.id },
        data: {
          paid_amount: fromPaisa(newTotalPaidPaisa),
          status: nextStatus,
          paid_date: nextStatus === "paid" ? now : challan.paid_date,
          payment_method: paymentMethod,
          updated_at: now,
        },
      });

      // 4. Allocate across student_fees in paisa (oldest / arrears first)
      let remainingAlloc = amountPaisa;
      for (const sf of challan.student_fees) {
        if (remainingAlloc <= 0) break;
        const netPaisa = toPaisa(sf.net_payable);
        const curPaidPaisa = toPaisa(sf.paid_amount);
        const duePaisa = Math.max(0, netPaisa - curPaidPaisa);
        const alloc = Math.min(remainingAlloc, duePaisa);

        const updatedPaid = curPaidPaisa + alloc;
        const updatedDue = Math.max(0, netPaisa - updatedPaid);
        const sfStatus =
          updatedPaid >= netPaisa
            ? "paid"
            : updatedPaid > 0
              ? "partial"
              : sf.status;

        await tx.student_fees.update({
          where: { id: sf.id },
          data: {
            paid_amount: fromPaisa(updatedPaid),
            due_amount: fromPaisa(updatedDue),
            status: sfStatus,
            paid_date: sfStatus === "paid" ? now : sf.paid_date,
            payment_method: paymentMethod,
            updated_at: now,
          },
        });

        remainingAlloc -= alloc;
      }

      // 5. Immutable audit record
      await logFeeAudit(
        {
          userId: params.actor.id,
          userName: params.actor.name,
          action: "PAYMENT_RECORDED",
          entityType: "fee_payment",
          entityId: payment.id,
          oldValues: {
            challan_paid: fromPaisa(alreadyPaidPaisa),
            challan_status: challan.status,
          },
          newValues: {
            receipt_no: receiptNo,
            challan_no: challan.challan_no,
            family_number: Number(challan.families.family_number),
            amount_paid: fromPaisa(amountPaisa),
            payment_method: paymentMethod,
            transaction_reference: reference,
            challan_paid: fromPaisa(newTotalPaidPaisa),
            challan_status: nextStatus,
          },
          reason: params.remarks?.trim() || null,
          ipAddress: params.actor.ipAddress ?? null,
        },
        tx,
      );

      return { payment, duplicate: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    if (err instanceof FeeValidationError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : "";
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";
    if (
      code === "P2034" ||
      msg.includes("40001") ||
      msg.toLowerCase().includes("could not serialize")
    ) {
      throw new FeeValidationError(
        "Another payment for this challan was just processed concurrently. Please refresh and verify the updated balance.",
        409,
      );
    }
    throw err;
  }
}

/**
 * Administrator-only payment reversal.
 * Payments are NEVER deleted — marked 'reversed' with reason, challan & student fees recalculated.
 */
export async function reverseChallanPayment(params: {
  paymentId: bigint;
  reason: string;
  actor: ActorInfo;
}) {
  const reason = params.reason.trim();
  if (reason.length < 10) {
    throw new FeeValidationError(
      "A clear reversal reason of at least 10 characters is required.",
      422,
    );
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
      const payment = await tx.fee_payments.findUnique({
        where: { id: params.paymentId },
      });

      if (!payment || !payment.family_fee_challan_id) {
        throw new FeeValidationError("Payment record not found.", 404);
      }

      if (payment.status === "reversed") {
        throw new FeeValidationError("This payment has already been reversed.", 422);
      }

      // Lock parent challan row
      await tx.$queryRawUnsafe(
        `SELECT id FROM family_fee_challans WHERE id = $1 FOR UPDATE`,
        payment.family_fee_challan_id,
      );

      const now = new Date();
      const reversedPayment = await tx.fee_payments.update({
        where: { id: payment.id },
        data: {
          status: "reversed",
          reversed_at: now,
          reversed_by_user_id:
            params.actor.id != null ? BigInt(params.actor.id) : null,
          reversal_reason: reason,
          updated_at: now,
        },
      });

      // Recompute total posted payments from scratch so numbers can NEVER drift
      const postedPayments = await tx.fee_payments.findMany({
        where: {
          family_fee_challan_id: payment.family_fee_challan_id,
          status: "posted",
          deleted_at: null,
        },
      });
      const totalPostedPaisa = postedPayments.reduce(
        (sum, p) => sum + toPaisa(p.amount_paid),
        0,
      );

      const challan = await tx.family_fee_challans.findUniqueOrThrow({
        where: { id: payment.family_fee_challan_id },
        include: {
          student_fees: {
            where: { deleted_at: null },
            orderBy: [{ due_date: "asc" }, { id: "asc" }],
          },
        },
      });

      const oldPaid = Number(challan.paid_amount);
      const oldStatus = challan.status;
      const payablePaisa = toPaisa(challan.payable_before_due);
      const nextChallanStatus =
        totalPostedPaisa >= payablePaisa && payablePaisa > 0
          ? "paid"
          : totalPostedPaisa > 0
            ? "partial"
            : challan.late_fine_applied_at
              ? "overdue"
              : "unpaid";

      await tx.family_fee_challans.update({
        where: { id: challan.id },
        data: {
          paid_amount: fromPaisa(totalPostedPaisa),
          status: nextChallanStatus,
          paid_date: nextChallanStatus === "paid" ? challan.paid_date : null,
          updated_at: now,
        },
      });

      // Re-allocate remaining posted payments cleanly across student_fees
      let remaining = totalPostedPaisa;
      for (const sf of challan.student_fees) {
        const netPaisa = toPaisa(sf.net_payable);
        const alloc = Math.min(remaining, netPaisa);
        const duePaisa = Math.max(0, netPaisa - alloc);
        const sfStatus =
          alloc >= netPaisa && netPaisa > 0
            ? "paid"
            : alloc > 0
              ? "partial"
              : "unpaid";

        await tx.student_fees.update({
          where: { id: sf.id },
          data: {
            paid_amount: fromPaisa(alloc),
            due_amount: fromPaisa(duePaisa),
            status: sfStatus,
            paid_date: sfStatus === "paid" ? sf.paid_date : null,
            updated_at: now,
          },
        });

        remaining -= alloc;
      }

      await logFeeAudit(
        {
          userId: params.actor.id,
          userName: params.actor.name,
          action: "PAYMENT_REVERSED",
          entityType: "fee_payment",
          entityId: payment.id,
          oldValues: {
            receipt_no: payment.receipt_no,
            amount_paid: Number(payment.amount_paid),
            challan_paid: oldPaid,
            challan_status: oldStatus,
          },
          newValues: {
            status: "reversed",
            challan_paid: fromPaisa(totalPostedPaisa),
            challan_status: nextChallanStatus,
          },
          reason,
          ipAddress: params.actor.ipAddress ?? null,
        },
        tx,
      );

      return reversedPayment;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    if (err instanceof FeeValidationError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : "";
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";
    if (
      code === "P2034" ||
      msg.includes("40001") ||
      msg.toLowerCase().includes("could not serialize")
    ) {
      throw new FeeValidationError(
        "Another operation on this challan was just processed concurrently. Please refresh and try again.",
        409,
      );
    }
    throw err;
  }
}

/**
 * Applies overdue late fines AT MOST ONCE per unpaid/partial challan past due_date.
 */
export async function applyOverdueLateFines(actor: ActorInfo) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const overdueChallans = await prisma.family_fee_challans.findMany({
    where: {
      deleted_at: null,
      status: { in: ["unpaid", "partial"] },
      due_date: { lt: todayStart },
      late_fine_applied_at: null,
      late_fine: { gt: 0 },
    },
  });

  const now = new Date();
  let appliedCount = 0;

  for (const ch of overdueChallans) {
    await prisma.$transaction(async (tx) => {
      const oldPayable = Number(ch.payable_before_due);
      const newPayable = Number(ch.payable_after_due);
      const nextStatus = Number(ch.paid_amount) > 0 ? "partial" : "overdue";

      await tx.family_fee_challans.update({
        where: { id: ch.id },
        data: {
          payable_before_due: newPayable,
          late_fine_applied_at: now,
          status: nextStatus,
          updated_at: now,
        },
      });

      await logFeeAudit(
        {
          userId: actor.id,
          userName: actor.name,
          action: "LATE_FINE_APPLIED",
          entityType: "family_fee_challan",
          entityId: ch.id,
          oldValues: { payable: oldPayable, status: ch.status },
          newValues: {
            challan_no: ch.challan_no,
            late_fine: Number(ch.late_fine),
            payable: newPayable,
            status: nextStatus,
          },
          reason: `Automatic late fine applied after due date (${ch.due_date.toISOString().slice(0, 10)})`,
          ipAddress: actor.ipAddress ?? null,
        },
        tx,
      );
    });
    appliedCount++;
  }

  return appliedCount;
}

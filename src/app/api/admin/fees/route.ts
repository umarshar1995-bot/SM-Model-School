import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  jsonError,
  jsonOk,
  requireAdministrator,
  requireApiUser,
} from "@/lib/api-helpers";
import { canUser } from "@/lib/auth";
import { toBigIntId } from "@/lib/serialize";
import {
  applyOverdueLateFines,
  FeeValidationError,
  generateFamilyChallan,
  generateMonthlyRoll,
  recordChallanPayment,
} from "@/lib/fee-service";
import { getClientIp } from "@/lib/audit";
import { getCurrentBillingMonth } from "@/lib/format";

export async function GET(request: NextRequest) {
  const { user, error } = await requireApiUser("ViewAny:Fee", request);
  if (error) return error;

  const sp = request.nextUrl.searchParams;
  const sessionParam = sp.get("sessionId");
  const monthParam = sp.get("month");
  const searchQuery = (sp.get("q") ?? "").trim();

  const [sessions, feeTypes, existingMonthsRows] = await Promise.all([
    prisma.academic_sessions.findMany({
      where: { deleted_at: null },
      orderBy: [{ is_current: "desc" }, { start_date: "desc" }],
    }),
    prisma.fee_types.findMany({
      where: { is_active: true },
      orderBy: { sort_order: "asc" },
    }),
    prisma.family_fee_challans.findMany({
      where: { deleted_at: null },
      distinct: ["billing_month"],
      select: { billing_month: true },
      orderBy: { id: "desc" },
    }),
  ]);

  const selectedSessionId = sessionParam
    ? toBigIntId(sessionParam)
    : sessions.find((s) => s.is_current)?.id ?? sessions[0]?.id ?? null;

  const availableMonths = existingMonthsRows.map((r) => r.billing_month);
  const selectedMonth =
    monthParam || availableMonths[0] || getCurrentBillingMonth();

  const numericQ = /^\d+$/.test(searchQuery) ? BigInt(searchQuery) : null;

  const challans = await prisma.family_fee_challans.findMany({
    where: {
      deleted_at: null,
      billing_month: selectedMonth,
      ...(selectedSessionId ? { academic_session_id: selectedSessionId } : {}),
      ...(searchQuery
        ? {
            OR: [
              { challan_no: { contains: searchQuery, mode: "insensitive" } },
              {
                families: {
                  OR: [
                    { guardian_name: { contains: searchQuery, mode: "insensitive" } },
                    { guardian_mobile: { contains: searchQuery, mode: "insensitive" } },
                    ...(numericQ ? [{ family_number: numericQ }] : []),
                  ],
                },
              },
              {
                student_fees: {
                  some: {
                    students: {
                      OR: [
                        { full_name: { contains: searchQuery, mode: "insensitive" } },
                        { admission_no: { contains: searchQuery, mode: "insensitive" } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      families: true,
      fee_payments: {
        where: { deleted_at: null },
        include: {
          users: { select: { id: true, name: true } },
          users_fee_payments_reversed_by_user_idTousers: {
            select: { id: true, name: true },
          },
        },
        orderBy: { id: "desc" },
      },
      student_fees: {
        where: { deleted_at: null },
        include: {
          fee_types: { select: { id: true, code: true, name: true } },
          students: {
            include: {
              student_enrollments: {
                where: { deleted_at: null },
                orderBy: { id: "desc" },
                take: 1,
                include: { school_classes: true, class_sections: true },
              },
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
    orderBy: { id: "desc" },
  });

  const totalBilled = challans.reduce(
    (sum, c) => sum + Number(c.payable_before_due),
    0,
  );
  const totalCollected = challans.reduce((sum, c) => sum + Number(c.paid_amount), 0);
  const totalArrears = challans.reduce((sum, c) => sum + Number(c.total_arrears), 0);
  const totalOutstanding = challans.reduce(
    (sum, c) => sum + Math.max(0, Number(c.payable_before_due) - Number(c.paid_amount)),
    0,
  );

  return jsonOk({
    sessions,
    feeTypes,
    selectedSessionId,
    selectedMonth,
    availableMonths,
    challans,
    permissions: {
      canEditFees: user.isSuperAdmin,
      canReverse: user.isSuperAdmin,
      canCollect: canUser(user, "Create:FeePayment"),
      canGenerate: canUser(user, "Create:FeeChallan"),
    },
    summary: {
      totalBilled,
      totalCollected,
      totalArrears,
      totalOutstanding,
      recoveryRate:
        totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 1000) / 10 : 0,
    },
  });
}

const billingOptionsSchema = {
  includeMonthly: z.boolean().optional(),
  includeExam: z.boolean().optional(),
  examTerm: z.string().max(40).optional().nullable(),
  includeBooks: z.boolean().optional(),
  includePromotion: z.boolean().optional(),
};

const feeActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate-roll"),
    billingMonth: z.string().min(3).max(40),
    sessionId: z.union([z.number(), z.string()]).optional().nullable(),
    ...billingOptionsSchema,
  }),
  z.object({
    action: z.literal("generate-single"),
    familyId: z.union([z.number(), z.string()]),
    billingMonth: z.string().min(3).max(40),
    sessionId: z.union([z.number(), z.string()]).optional().nullable(),
    ...billingOptionsSchema,
  }),
  z.object({
    action: z.literal("collect-payment"),
    challanId: z.union([z.number(), z.string()]),
    amountPaid: z.number(),
    paymentMethod: z.string().min(1).max(50).default("Cash"),
    reference: z.string().max(100).optional().nullable(),
    remarks: z.string().max(400).optional().nullable(),
    idempotencyKey: z.string().max(80).optional().nullable(),
  }),
  z.object({
    action: z.literal("apply-late-fines"),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = feeActionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        parsed.error.issues[0]?.message || "Invalid fee action payload.",
        422,
      );
    }

    const ipAddress = getClientIp(request);

    if (parsed.data.action === "apply-late-fines") {
      const { user, error } = await requireAdministrator(
        request,
        "apply_late_fines",
      );
      if (error) return error;

      const appliedCount = await applyOverdueLateFines({
        id: user.id,
        name: user.name,
        ipAddress,
      });

      return jsonOk({
        appliedCount,
        message:
          appliedCount > 0
            ? `Applied overdue late fine to ${appliedCount} challan(s).`
            : "No unpaid overdue challans needed a late fine today.",
      });
    }

    if (parsed.data.action === "generate-roll") {
      const { user, error } = await requireApiUser("Create:FeeChallan", request);
      if (error) return error;

      const options = {
        includeMonthly: parsed.data.includeMonthly ?? true,
        includeExam: parsed.data.includeExam ?? false,
        examTerm: parsed.data.examTerm ?? null,
        includeBooks: parsed.data.includeBooks ?? false,
        includePromotion: parsed.data.includePromotion ?? false,
      };

      const count = await generateMonthlyRoll(
        parsed.data.billingMonth.trim(),
        parsed.data.sessionId ? toBigIntId(parsed.data.sessionId) : null,
        options,
        { id: user.id, name: user.name, ipAddress },
      );

      const includedLabels = [
        options.includeMonthly && "Monthly",
        options.includeExam && `Exam (${options.examTerm || "Term"})`,
        options.includeBooks && "Books",
        options.includePromotion && "Promotion",
      ].filter(Boolean);

      return jsonOk({
        message: `Generated ${count} family challan(s) for ${parsed.data.billingMonth} (${includedLabels.join(" + ") || "Monthly"}).`,
        count,
      });
    }

    if (parsed.data.action === "generate-single") {
      const { user, error } = await requireApiUser("Create:FeeChallan", request);
      if (error) return error;

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 10);

      const challan = await generateFamilyChallan({
        familyId: toBigIntId(parsed.data.familyId),
        billingMonth: parsed.data.billingMonth.trim(),
        dueDate,
        issueDate: new Date(),
        sessionId: parsed.data.sessionId ? toBigIntId(parsed.data.sessionId) : null,
        options: {
          includeMonthly: parsed.data.includeMonthly ?? true,
          includeExam: parsed.data.includeExam ?? false,
          examTerm: parsed.data.examTerm ?? null,
          includeBooks: parsed.data.includeBooks ?? false,
          includePromotion: parsed.data.includePromotion ?? false,
        },
        actor: { id: user.id, name: user.name, ipAddress },
      });
      return jsonOk({ challan }, 201);
    }

    // collect-payment
    const { user, error } = await requireApiUser("Create:FeePayment", request);
    if (error) return error;

    const { payment, duplicate } = await recordChallanPayment({
      challanId: toBigIntId(parsed.data.challanId),
      amountPaid: parsed.data.amountPaid,
      paymentMethod: parsed.data.paymentMethod,
      reference: parsed.data.reference ?? null,
      remarks: parsed.data.remarks ?? null,
      idempotencyKey: parsed.data.idempotencyKey ?? null,
      actor: { id: user.id, name: user.name, ipAddress },
    });

    return jsonOk({
      message: duplicate
        ? `Duplicate submission ignored — returning original Receipt ${payment.receipt_no}.`
        : `Recorded payment of Rs. ${Number(payment.amount_paid).toLocaleString("en-PK")} (Receipt ${payment.receipt_no}).`,
      payment,
      duplicate,
    });
  } catch (err) {
    if (err instanceof FeeValidationError) {
      return jsonError(err.message, err.status);
    }
    console.error("Fee API error:", err);
    return jsonError(
      err instanceof Error ? err.message : "Failed to process fee action.",
      500,
    );
  }
}

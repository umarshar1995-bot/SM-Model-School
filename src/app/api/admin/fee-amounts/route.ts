import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  jsonError,
  jsonOk,
  requireAdministrator,
  requireApiUser,
} from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";
import { getClientIp, logFeeAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const { user, error } = await requireApiUser("ViewAny:Fee", request);
  if (error) return error;

  const sessionParam = request.nextUrl.searchParams.get("sessionId");
  const historyCell = request.nextUrl.searchParams.get("historyEntityId");

  if (historyCell) {
    if (!user.isSuperAdmin) {
      return jsonError("Forbidden: only the Administrator can view audit history.", 403);
    }
    const logs = await prisma.fee_audit_logs.findMany({
      where: {
        entity_type: "class_fee_amount",
        entity_id: toBigIntId(historyCell),
      },
      orderBy: { created_at: "desc" },
      take: 30,
    });
    return jsonOk({ logs });
  }

  const [sessions, classes, feeTypes] = await Promise.all([
    prisma.academic_sessions.findMany({
      where: { deleted_at: null },
      orderBy: [{ is_current: "desc" }, { start_date: "desc" }],
    }),
    prisma.school_classes.findMany({
      where: { is_active: true, deleted_at: null },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    }),
    prisma.fee_types.findMany({
      where: { is_active: true },
      orderBy: { sort_order: "asc" },
    }),
  ]);

  const selectedSession = sessionParam
    ? sessions.find((s) => String(s.id) === sessionParam) ?? sessions[0] ?? null
    : sessions.find((s) => s.is_current) ?? sessions[0] ?? null;

  const amounts = selectedSession
    ? await prisma.class_fee_amounts.findMany({
        where: { academic_session_id: selectedSession.id },
        include: { users: { select: { id: true, name: true } } },
      })
    : [];

  return jsonOk({
    sessions,
    selectedSession,
    classes,
    feeTypes,
    amounts,
    canEdit: user.isSuperAdmin,
  });
}

const updateAmountSchema = z.object({
  school_class_id: z.union([z.number(), z.string()]),
  academic_session_id: z.union([z.number(), z.string()]),
  fee_type_id: z.union([z.number(), z.string()]),
  amount: z.number().min(0).max(1_000_000),
  reason: z.string().max(300).optional().nullable(),
});

export async function PUT(request: NextRequest) {
  const { user, error } = await requireAdministrator(
    request,
    "fee_amounts_update",
  );
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = updateAmountSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        "Amount must be a valid number between Rs. 0 and Rs. 1,000,000.",
        422,
      );
    }

    const classId = toBigIntId(parsed.data.school_class_id);
    const sessionId = toBigIntId(parsed.data.academic_session_id);
    const feeTypeId = toBigIntId(parsed.data.fee_type_id);
    const roundedAmount = Math.round(parsed.data.amount * 100) / 100;
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const [schoolClass, session, feeType, existing] = await Promise.all([
        tx.school_classes.findUniqueOrThrow({ where: { id: classId } }),
        tx.academic_sessions.findUniqueOrThrow({ where: { id: sessionId } }),
        tx.fee_types.findUniqueOrThrow({ where: { id: feeTypeId } }),
        tx.class_fee_amounts.findUnique({
          where: {
            school_class_id_academic_session_id_fee_type_id: {
              school_class_id: classId,
              academic_session_id: sessionId,
              fee_type_id: feeTypeId,
            },
          },
        }),
      ]);

      const oldAmount = existing ? Number(existing.amount) : null;

      const updated = await tx.class_fee_amounts.upsert({
        where: {
          school_class_id_academic_session_id_fee_type_id: {
            school_class_id: classId,
            academic_session_id: sessionId,
            fee_type_id: feeTypeId,
          },
        },
        update: {
          amount: roundedAmount,
          updated_by_user_id: BigInt(user.id),
          updated_at: now,
        },
        create: {
          school_class_id: classId,
          academic_session_id: sessionId,
          fee_type_id: feeTypeId,
          amount: roundedAmount,
          updated_by_user_id: BigInt(user.id),
          created_at: now,
          updated_at: now,
        },
        include: { users: { select: { id: true, name: true } } },
      });

      // Keep legacy class_fee_structures mirrored for MONTHLY / EXAM
      if (feeType.code === "MONTHLY" || feeType.code === "EXAM") {
        const legacy = await tx.class_fee_structures.findFirst({
          where: { school_class_id: classId, academic_session_id: sessionId },
        });
        if (legacy) {
          await tx.class_fee_structures.update({
            where: { id: legacy.id },
            data: {
              ...(feeType.code === "MONTHLY"
                ? { tuition_fee: roundedAmount }
                : { exam_fee: roundedAmount }),
              updated_at: now,
            },
          });
        }
      }

      await logFeeAudit(
        {
          userId: user.id,
          userName: user.name,
          action: "FEE_AMOUNT_CHANGED",
          entityType: "class_fee_amount",
          entityId: updated.id,
          oldValues: {
            class_name: schoolClass.name,
            session_name: session.name,
            fee_type: feeType.code,
            amount: oldAmount,
          },
          newValues: {
            class_name: schoolClass.name,
            session_name: session.name,
            fee_type: feeType.code,
            amount: roundedAmount,
          },
          reason: parsed.data.reason?.trim() || null,
          ipAddress: getClientIp(request),
        },
        tx,
      );

      return updated;
    });

    return jsonOk({ record: result });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Failed to update fee amount.",
      400,
    );
  }
}

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

const structureSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  school_class_id: z.union([z.number(), z.string()]),
  academic_session_id: z.union([z.number(), z.string()]).nullable().optional(),
  tuition_fee: z.number().min(0).max(1_000_000),
  admission_fee: z.number().min(0).max(1_000_000).default(0),
  exam_fee: z.number().min(0).max(1_000_000).default(0),
  computer_fee: z.number().min(0).max(1_000_000).default(0),
  activity_fee: z.number().min(0).max(1_000_000).default(0),
  late_fine: z.number().min(0).max(100_000).default(200),
});

export async function GET(request: NextRequest) {
  const { user, error } = await requireApiUser("ViewAny:Fee", request);
  if (error) return error;

  const sessionParam = request.nextUrl.searchParams.get("sessionId");

  const [sessions, classes, structures] = await Promise.all([
    prisma.academic_sessions.findMany({
      where: { deleted_at: null },
      orderBy: [{ is_current: "desc" }, { start_date: "desc" }],
    }),
    prisma.school_classes.findMany({
      where: { is_active: true, deleted_at: null },
      orderBy: { sort_order: "asc" },
    }),
    prisma.class_fee_structures.findMany({
      where: {
        deleted_at: null,
        ...(sessionParam ? { academic_session_id: toBigIntId(sessionParam) } : {}),
      },
      include: { school_classes: true, academic_sessions: true },
      orderBy: [{ school_classes: { sort_order: "asc" } }],
    }),
  ]);

  return jsonOk({ sessions, classes, structures, canEdit: user.isSuperAdmin });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAdministrator(
    request,
    "class_fee_structures_save",
  );
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = structureSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid fee structure values.", 422);
    }

    const classId = toBigIntId(parsed.data.school_class_id);
    const sessionId = parsed.data.academic_session_id
      ? toBigIntId(parsed.data.academic_session_id)
      : null;
    const now = new Date();

    const record = await prisma.$transaction(async (tx) => {
      const existing = await tx.class_fee_structures.findFirst({
        where: { school_class_id: classId, academic_session_id: sessionId },
      });

      const saved = existing
        ? await tx.class_fee_structures.update({
            where: { id: existing.id },
            data: {
              tuition_fee: parsed.data.tuition_fee,
              admission_fee: parsed.data.admission_fee,
              exam_fee: parsed.data.exam_fee,
              computer_fee: parsed.data.computer_fee,
              activity_fee: parsed.data.activity_fee,
              late_fine: parsed.data.late_fine,
              deleted_at: null,
              updated_at: now,
            },
            include: { school_classes: true, academic_sessions: true },
          })
        : await tx.class_fee_structures.create({
            data: {
              school_class_id: classId,
              academic_session_id: sessionId,
              tuition_fee: parsed.data.tuition_fee,
              admission_fee: parsed.data.admission_fee,
              exam_fee: parsed.data.exam_fee,
              computer_fee: parsed.data.computer_fee,
              activity_fee: parsed.data.activity_fee,
              late_fine: parsed.data.late_fine,
              created_at: now,
              updated_at: now,
            },
            include: { school_classes: true, academic_sessions: true },
          });

      await logFeeAudit(
        {
          userId: user.id,
          userName: user.name,
          action: "FEE_AMOUNT_CHANGED",
          entityType: "class_fee_structure",
          entityId: saved.id,
          oldValues: existing
            ? {
                tuition_fee: Number(existing.tuition_fee),
                exam_fee: Number(existing.exam_fee),
                late_fine: Number(existing.late_fine),
              }
            : null,
          newValues: {
            tuition_fee: parsed.data.tuition_fee,
            exam_fee: parsed.data.exam_fee,
            late_fine: parsed.data.late_fine,
          },
          ipAddress: getClientIp(request),
        },
        tx,
      );

      return saved;
    });

    return jsonOk({ structure: record }, 201);
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Failed to save fee structure.",
      500,
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { user, error } = await requireAdministrator(
    request,
    "class_fee_structures_delete",
  );
  if (error) return error;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return jsonError("Missing id.", 400);

  const sid = toBigIntId(id);
  await prisma.$transaction(async (tx) => {
    await tx.class_fee_structures.update({
      where: { id: sid },
      data: { deleted_at: new Date(), updated_at: new Date() },
    });
    await logFeeAudit(
      {
        userId: user.id,
        userName: user.name,
        action: "FEE_AMOUNT_CHANGED",
        entityType: "class_fee_structure",
        entityId: sid,
        reason: "Deleted legacy class fee structure",
        ipAddress: getClientIp(request),
      },
      tx,
    );
  });

  return jsonOk({ ok: true });
}

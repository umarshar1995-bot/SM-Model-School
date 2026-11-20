import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";

const createLeaveSchema = z.object({
  academic_session_id: z.union([z.number(), z.string()]).optional().nullable(),
  leave_type: z.string().min(1).max(50),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  reason: z.string().optional().nullable(),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
});

const patchLeaveSchema = z.object({
  leave_id: z.union([z.number(), z.string()]),
  status: z.enum(["pending", "approved", "rejected"]),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  try {
    const { id } = await context.params;
    const studentId = toBigIntId(id);
    const body = await request.json();
    const parsed = createLeaveSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid leave details provided.", 400);
    }

    const start = new Date(parsed.data.start_date);
    const end = new Date(parsed.data.end_date);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return jsonError("End date must be on or after start date.", 400);
    }

    const daysCount =
      Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    let sessionId: bigint | null = parsed.data.academic_session_id
      ? toBigIntId(parsed.data.academic_session_id)
      : null;
    if (!sessionId) {
      const current = await prisma.academic_sessions.findFirst({
        where: { is_current: true, deleted_at: null },
      });
      sessionId = current?.id ?? null;
    }

    const now = new Date();
    const leave = await prisma.student_leaves.create({
      data: {
        student_id: studentId,
        academic_session_id: sessionId,
        leave_type: parsed.data.leave_type,
        start_date: start,
        end_date: end,
        days_count: daysCount,
        reason: parsed.data.reason || null,
        status: parsed.data.status,
        approved_by: parsed.data.status === "approved" ? user.name : null,
        created_at: now,
        updated_at: now,
      },
    });

    return jsonOk({ leave }, 201);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to save leave.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = patchLeaveSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid leave update request.", 400);
    }

    const leave = await prisma.student_leaves.update({
      where: { id: toBigIntId(parsed.data.leave_id) },
      data: {
        status: parsed.data.status,
        approved_by: parsed.data.status === "approved" ? user.name : null,
        updated_at: new Date(),
      },
    });

    return jsonOk({ leave });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to update leave.", 500);
  }
}

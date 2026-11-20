import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";

const sessionSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  name: z.string().min(1).max(20),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  is_current: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser("ViewAny:AcademicSession");
  if (error) return error;

  const trashed = request.nextUrl.searchParams.get("trashed") === "1";
  const sessions = await prisma.academic_sessions.findMany({
    where: { deleted_at: trashed ? { not: null } : null },
    include: {
      _count: {
        select: { student_enrollments: { where: { deleted_at: null } } },
      },
    },
    orderBy: [{ is_current: "desc" }, { start_date: "desc" }],
  });

  return jsonOk({ sessions });
}

export async function POST(request: NextRequest) {
  const { error } = await requireApiUser("Create:AcademicSession");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = sessionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid academic session data.", 400);
    }

    const now = new Date();
    const session = await prisma.$transaction(async (tx) => {
      if (parsed.data.is_current) {
        await tx.academic_sessions.updateMany({
          data: { is_current: false, updated_at: now },
        });
      }
      return tx.academic_sessions.create({
        data: {
          name: parsed.data.name.trim(),
          start_date: parsed.data.start_date ? new Date(parsed.data.start_date) : null,
          end_date: parsed.data.end_date ? new Date(parsed.data.end_date) : null,
          is_current: parsed.data.is_current,
          is_active: parsed.data.is_active,
          created_at: now,
          updated_at: now,
        },
      });
    });

    return jsonOk({ session }, 201);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to create session.", 400);
  }
}

export async function PUT(request: NextRequest) {
  const { error } = await requireApiUser("Update:AcademicSession");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = sessionSchema.safeParse(body);
    if (!parsed.success || !parsed.data.id) {
      return jsonError("Invalid academic session update.", 400);
    }

    const id = toBigIntId(parsed.data.id);
    const now = new Date();
    const session = await prisma.$transaction(async (tx) => {
      if (parsed.data.is_current) {
        await tx.academic_sessions.updateMany({
          where: { id: { not: id } },
          data: { is_current: false, updated_at: now },
        });
      }
      return tx.academic_sessions.update({
        where: { id },
        data: {
          name: parsed.data.name.trim(),
          start_date: parsed.data.start_date ? new Date(parsed.data.start_date) : null,
          end_date: parsed.data.end_date ? new Date(parsed.data.end_date) : null,
          is_current: parsed.data.is_current,
          is_active: parsed.data.is_active,
          updated_at: now,
        },
      });
    });

    return jsonOk({ session });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to update session.", 400);
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireApiUser("Delete:AcademicSession");
  if (error) return error;

  const id = request.nextUrl.searchParams.get("id");
  const mode = request.nextUrl.searchParams.get("mode") ?? "soft";
  if (!id) return jsonError("Missing id.", 400);

  const sid = toBigIntId(id);
  if (mode === "restore") {
    await prisma.academic_sessions.update({
      where: { id: sid },
      data: { deleted_at: null, updated_at: new Date() },
    });
  } else if (mode === "force") {
    await prisma.academic_sessions.delete({ where: { id: sid } });
  } else {
    await prisma.academic_sessions.update({
      where: { id: sid },
      data: { deleted_at: new Date(), updated_at: new Date() },
    });
  }
  return jsonOk({ ok: true });
}

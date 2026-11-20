import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";
import { generateRandomToken, hashToken } from "@/lib/auth";

const teacherSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  name: z.string().min(1).max(150),
  mobile: z.string().max(20).optional().nullable(),
  employee_no: z.string().max(50).optional().nullable(),
  photo_path: z.string().max(255).optional().nullable(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser("ViewAny:Teacher");
  if (error) return error;

  const sp = request.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const status = sp.get("status") ?? "";
  const trashed = sp.get("trashed") === "1";

  const teachers = await prisma.teachers.findMany({
    where: {
      deleted_at: trashed ? { not: null } : null,
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { employee_no: { contains: q, mode: "insensitive" } },
              { mobile: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      users: { select: { id: true, email: true } },
      teacher_devices: {
        where: { revoked_at: null },
        orderBy: { last_used_at: "desc" },
      },
      _count: {
        select: {
          teacher_sections: true,
          teacher_subject_assignments: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return jsonOk({ teachers });
}

export async function POST(request: NextRequest) {
  const { error } = await requireApiUser("Create:Teacher");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = teacherSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid teacher details.", 400);

    const now = new Date();
    const teacher = await prisma.teachers.create({
      data: {
        name: parsed.data.name.trim(),
        mobile: parsed.data.mobile?.trim() || null,
        employee_no: parsed.data.employee_no?.trim() || null,
        photo_path: parsed.data.photo_path || null,
        status: parsed.data.status,
        created_at: now,
        updated_at: now,
      },
    });
    return jsonOk({ teacher }, 201);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to create teacher.", 400);
  }
}

export async function PUT(request: NextRequest) {
  const { error } = await requireApiUser("Update:Teacher");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = teacherSchema.safeParse(body);
    if (!parsed.success || !parsed.data.id) {
      return jsonError("Invalid teacher update.", 400);
    }

    const teacher = await prisma.teachers.update({
      where: { id: toBigIntId(parsed.data.id) },
      data: {
        name: parsed.data.name.trim(),
        mobile: parsed.data.mobile?.trim() || null,
        employee_no: parsed.data.employee_no?.trim() || null,
        photo_path: parsed.data.photo_path || null,
        status: parsed.data.status,
        updated_at: new Date(),
      },
    });
    return jsonOk({ teacher });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to update teacher.", 400);
  }
}

const teacherActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("invite"),
    teacherId: z.union([z.number(), z.string()]),
  }),
  z.object({
    action: z.literal("revoke-device"),
    deviceId: z.union([z.number(), z.string()]),
  }),
]);

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireApiUser("Create:Teacher");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = teacherActionSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid action.", 400);

    const now = new Date();
    if (parsed.data.action === "revoke-device") {
      await prisma.teacher_devices.update({
        where: { id: toBigIntId(parsed.data.deviceId) },
        data: { revoked_at: now, updated_at: now },
      });
      return jsonOk({ ok: true });
    }

    const teacherId = toBigIntId(parsed.data.teacherId);
    const token = generateRandomToken(64);
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.teacher_invites.updateMany({
        where: { teacher_id: teacherId, used_at: null },
        data: { used_at: now, updated_at: now },
      });
      await tx.teacher_invites.create({
        data: {
          teacher_id: teacherId,
          created_by: BigInt(user.id),
          token_hash: hashToken(token),
          expires_at: expiresAt,
          created_at: now,
          updated_at: now,
        },
      });
    });

    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    return jsonOk({
      inviteUrl: `${origin}/t/invite/${token}`,
      token,
      expiresAt,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to issue invite.", 400);
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireApiUser("Delete:Teacher");
  if (error) return error;

  const id = request.nextUrl.searchParams.get("id");
  const mode = request.nextUrl.searchParams.get("mode") ?? "soft";
  if (!id) return jsonError("Missing id.", 400);

  const tid = toBigIntId(id);
  if (mode === "restore") {
    await prisma.teachers.update({
      where: { id: tid },
      data: { deleted_at: null, updated_at: new Date() },
    });
  } else if (mode === "force") {
    await prisma.teachers.delete({ where: { id: tid } });
  } else {
    await prisma.teachers.update({
      where: { id: tid },
      data: { deleted_at: new Date(), updated_at: new Date() },
    });
  }
  return jsonOk({ ok: true });
}

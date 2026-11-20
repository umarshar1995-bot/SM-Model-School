import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";

const sectionSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  class_id: z.union([z.number(), z.string()]),
  name: z.string().min(1).max(10),
  capacity: z.number().int().min(1).nullable().optional(),
  class_teacher_user_id: z.union([z.number(), z.string()]).nullable().optional(),
  is_active: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser("ViewAny:ClassSection");
  if (error) return error;

  const trashed = request.nextUrl.searchParams.get("trashed") === "1";

  const [sections, classes, users] = await Promise.all([
    prisma.class_sections.findMany({
      where: { deleted_at: trashed ? { not: null } : null },
      include: {
        school_classes: true,
        users: { select: { id: true, name: true, email: true } },
        _count: {
          select: {
            student_enrollments: { where: { deleted_at: null, status: "active" } },
          },
        },
      },
      orderBy: [{ school_classes: { sort_order: "asc" } }, { name: "asc" }],
    }),
    prisma.school_classes.findMany({
      where: { is_active: true, deleted_at: null },
      orderBy: { sort_order: "asc" },
    }),
    prisma.users.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  return jsonOk({ sections, classes, users });
}

export async function POST(request: NextRequest) {
  const { error } = await requireApiUser("Create:ClassSection");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = sectionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid section data (section name max 10 characters).", 400);
    }

    const now = new Date();
    const section = await prisma.class_sections.create({
      data: {
        class_id: toBigIntId(parsed.data.class_id),
        name: parsed.data.name.trim(),
        capacity: parsed.data.capacity ?? null,
        class_teacher_user_id: parsed.data.class_teacher_user_id
          ? toBigIntId(parsed.data.class_teacher_user_id)
          : null,
        is_active: parsed.data.is_active,
        created_at: now,
        updated_at: now,
      },
    });
    return jsonOk({ section }, 201);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to create section.", 400);
  }
}

export async function PUT(request: NextRequest) {
  const { error } = await requireApiUser("Update:ClassSection");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = sectionSchema.safeParse(body);
    if (!parsed.success || !parsed.data.id) {
      return jsonError("Invalid section update data.", 400);
    }

    const section = await prisma.class_sections.update({
      where: { id: toBigIntId(parsed.data.id) },
      data: {
        class_id: toBigIntId(parsed.data.class_id),
        name: parsed.data.name.trim(),
        capacity: parsed.data.capacity ?? null,
        class_teacher_user_id: parsed.data.class_teacher_user_id
          ? toBigIntId(parsed.data.class_teacher_user_id)
          : null,
        is_active: parsed.data.is_active,
        updated_at: new Date(),
      },
    });
    return jsonOk({ section });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to update section.", 400);
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireApiUser("Delete:ClassSection");
  if (error) return error;

  const id = request.nextUrl.searchParams.get("id");
  const mode = request.nextUrl.searchParams.get("mode") ?? "soft";
  if (!id) return jsonError("Missing id.", 400);

  const sid = toBigIntId(id);
  if (mode === "restore") {
    await prisma.class_sections.update({
      where: { id: sid },
      data: { deleted_at: null, updated_at: new Date() },
    });
  } else if (mode === "force") {
    await prisma.class_sections.delete({ where: { id: sid } });
  } else {
    await prisma.class_sections.update({
      where: { id: sid },
      data: { deleted_at: new Date(), updated_at: new Date() },
    });
  }
  return jsonOk({ ok: true });
}

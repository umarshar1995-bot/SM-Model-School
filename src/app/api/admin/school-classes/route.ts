import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";

const classSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  name: z.string().min(1).max(50),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser("ViewAny:SchoolClass");
  if (error) return error;

  const trashed = request.nextUrl.searchParams.get("trashed") === "1";
  const classes = await prisma.school_classes.findMany({
    where: { deleted_at: trashed ? { not: null } : null },
    include: {
      _count: {
        select: {
          class_sections: { where: { deleted_at: null } },
          student_enrollments: { where: { deleted_at: null, status: "active" } },
        },
      },
    },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
  });

  return jsonOk({ classes });
}

export async function POST(request: NextRequest) {
  const { error } = await requireApiUser("Create:SchoolClass");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = classSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid class details.", 400);

    const now = new Date();
    const schoolClass = await prisma.school_classes.create({
      data: {
        name: parsed.data.name.trim(),
        sort_order: parsed.data.sort_order,
        is_active: parsed.data.is_active,
        created_at: now,
        updated_at: now,
      },
    });
    return jsonOk({ schoolClass }, 201);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to create class.", 400);
  }
}

export async function PUT(request: NextRequest) {
  const { error } = await requireApiUser("Update:SchoolClass");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = classSchema.safeParse(body);
    if (!parsed.success || !parsed.data.id) return jsonError("Invalid class update.", 400);

    const schoolClass = await prisma.school_classes.update({
      where: { id: toBigIntId(parsed.data.id) },
      data: {
        name: parsed.data.name.trim(),
        sort_order: parsed.data.sort_order,
        is_active: parsed.data.is_active,
        updated_at: new Date(),
      },
    });
    return jsonOk({ schoolClass });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to update class.", 400);
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireApiUser("Delete:SchoolClass");
  if (error) return error;

  const id = request.nextUrl.searchParams.get("id");
  const mode = request.nextUrl.searchParams.get("mode") ?? "soft";
  if (!id) return jsonError("Missing id.", 400);

  const cid = toBigIntId(id);
  if (mode === "restore") {
    await prisma.school_classes.update({
      where: { id: cid },
      data: { deleted_at: null, updated_at: new Date() },
    });
  } else if (mode === "force") {
    await prisma.school_classes.delete({ where: { id: cid } });
  } else {
    await prisma.school_classes.update({
      where: { id: cid },
      data: { deleted_at: new Date(), updated_at: new Date() },
    });
  }
  return jsonOk({ ok: true });
}

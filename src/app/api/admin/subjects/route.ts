import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";

const subjectSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(30),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser("ViewAny:Subject");
  if (error) return error;

  const trashed = request.nextUrl.searchParams.get("trashed") === "1";
  const subjects = await prisma.subjects.findMany({
    where: { deleted_at: trashed ? { not: null } : null },
    include: {
      _count: {
        select: { class_subjects: { where: { deleted_at: null } } },
      },
    },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
  });

  return jsonOk({ subjects });
}

export async function POST(request: NextRequest) {
  const { error } = await requireApiUser("Create:Subject");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = subjectSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid subject fields.", 400);

    const now = new Date();
    const subject = await prisma.subjects.create({
      data: {
        name: parsed.data.name.trim(),
        code: parsed.data.code.trim().toUpperCase(),
        sort_order: parsed.data.sort_order,
        is_active: parsed.data.is_active,
        created_at: now,
        updated_at: now,
      },
    });
    return jsonOk({ subject }, 201);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to create subject.", 400);
  }
}

export async function PUT(request: NextRequest) {
  const { error } = await requireApiUser("Update:Subject");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = subjectSchema.safeParse(body);
    if (!parsed.success || !parsed.data.id) return jsonError("Invalid subject update.", 400);

    const subject = await prisma.subjects.update({
      where: { id: toBigIntId(parsed.data.id) },
      data: {
        name: parsed.data.name.trim(),
        code: parsed.data.code.trim().toUpperCase(),
        sort_order: parsed.data.sort_order,
        is_active: parsed.data.is_active,
        updated_at: new Date(),
      },
    });
    return jsonOk({ subject });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to update subject.", 400);
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireApiUser("Delete:Subject");
  if (error) return error;

  const id = request.nextUrl.searchParams.get("id");
  const mode = request.nextUrl.searchParams.get("mode") ?? "soft";
  if (!id) return jsonError("Missing id.", 400);

  const sid = toBigIntId(id);
  if (mode === "restore") {
    await prisma.subjects.update({
      where: { id: sid },
      data: { deleted_at: null, updated_at: new Date() },
    });
  } else if (mode === "force") {
    await prisma.subjects.delete({ where: { id: sid } });
  } else {
    await prisma.subjects.update({
      where: { id: sid },
      data: { deleted_at: new Date(), updated_at: new Date() },
    });
  }
  return jsonOk({ ok: true });
}

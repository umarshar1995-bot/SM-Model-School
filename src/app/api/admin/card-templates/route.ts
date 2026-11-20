import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";

const templateSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(80),
  template_type: z.enum(["student", "staff"]),
  orientation: z.enum(["portrait", "landscape"]),
  front_view: z.string().min(1).max(180),
  back_view: z.string().min(1).max(180),
  settings: z.record(z.string(), z.unknown()).nullable().optional(),
  is_active: z.boolean().default(true),
  is_default: z.boolean().default(false),
  class_group_ids: z.array(z.union([z.number(), z.string()])).optional(),
});

export async function GET() {
  const { error } = await requireApiUser("ViewAny:CardTemplate");
  if (error) return error;

  const [templates, classGroups, previewStudent, previewTeacher] = await Promise.all([
    prisma.card_templates.findMany({
      where: { deleted_at: null },
      include: {
        card_template_class_group: { include: { class_groups: true } },
      },
      orderBy: [{ is_default: "desc" }, { name: "asc" }],
    }),
    prisma.class_groups.findMany({
      where: { is_active: true },
      orderBy: { sort_order: "asc" },
    }),
    prisma.students.findFirst({
      where: { deleted_at: null },
      include: {
        families: true,
        student_enrollments: {
          where: { deleted_at: null },
          orderBy: { id: "desc" },
          take: 1,
          include: { school_classes: true, class_sections: true },
        },
      },
    }),
    prisma.teachers.findFirst({
      where: { deleted_at: null },
    }),
  ]);

  return jsonOk({ templates, classGroups, previewStudent, previewTeacher });
}

export async function POST(request: NextRequest) {
  const { error } = await requireApiUser("Create:CardTemplate");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = templateSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid template data.", 400);

    const now = new Date();
    const template = await prisma.$transaction(async (tx) => {
      if (parsed.data.is_default) {
        await tx.card_templates.updateMany({
          data: { is_default: false, updated_at: now },
        });
      }
      const created = await tx.card_templates.create({
        data: {
          name: parsed.data.name.trim(),
          slug: parsed.data.slug.trim().toLowerCase(),
          template_type: parsed.data.template_type,
          orientation: parsed.data.orientation,
          front_view: parsed.data.front_view.trim(),
          back_view: parsed.data.back_view.trim(),
          settings: parsed.data.settings
            ? (parsed.data.settings as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          is_active: parsed.data.is_active,
          is_default: parsed.data.is_default,
          created_at: now,
          updated_at: now,
        },
      });
      if (parsed.data.class_group_ids?.length) {
        await tx.card_template_class_group.createMany({
          data: parsed.data.class_group_ids.map((gid) => ({
            card_template_id: created.id,
            class_group_id: toBigIntId(gid),
          })),
        });
      }
      return created;
    });

    return jsonOk({ template }, 201);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to create template.", 400);
  }
}

export async function PUT(request: NextRequest) {
  const { error } = await requireApiUser("Update:CardTemplate");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = templateSchema.safeParse(body);
    if (!parsed.success || !parsed.data.id) {
      return jsonError("Invalid template update.", 400);
    }

    const id = toBigIntId(parsed.data.id);
    const now = new Date();

    const template = await prisma.$transaction(async (tx) => {
      if (parsed.data.is_default) {
        await tx.card_templates.updateMany({
          where: { id: { not: id } },
          data: { is_default: false, updated_at: now },
        });
      }
      const updated = await tx.card_templates.update({
        where: { id },
        data: {
          name: parsed.data.name.trim(),
          slug: parsed.data.slug.trim().toLowerCase(),
          template_type: parsed.data.template_type,
          orientation: parsed.data.orientation,
          front_view: parsed.data.front_view.trim(),
          back_view: parsed.data.back_view.trim(),
          settings: parsed.data.settings
            ? (parsed.data.settings as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          is_active: parsed.data.is_active,
          is_default: parsed.data.is_default,
          updated_at: now,
        },
      });

      if (parsed.data.class_group_ids) {
        await tx.card_template_class_group.deleteMany({
          where: { card_template_id: id },
        });
        if (parsed.data.class_group_ids.length > 0) {
          await tx.card_template_class_group.createMany({
            data: parsed.data.class_group_ids.map((gid) => ({
              card_template_id: id,
              class_group_id: toBigIntId(gid),
            })),
          });
        }
      }
      return updated;
    });

    return jsonOk({ template });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to update template.", 400);
  }
}

export async function PATCH(request: NextRequest) {
  const { error } = await requireApiUser("Update:CardTemplate");
  if (error) return error;

  try {
    const body = await request.json();
    if (!body?.id) return jsonError("Missing template id.", 400);

    const id = toBigIntId(body.id);
    const now = new Date();
    await prisma.$transaction([
      prisma.card_templates.updateMany({
        data: { is_default: false, updated_at: now },
      }),
      prisma.card_templates.update({
        where: { id },
        data: { is_default: true, updated_at: now },
      }),
    ]);
    return jsonOk({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to set default.", 400);
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireApiUser("Delete:CardTemplate");
  if (error) return error;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return jsonError("Missing id.", 400);

  await prisma.card_templates.update({
    where: { id: toBigIntId(id) },
    data: { deleted_at: new Date(), updated_at: new Date() },
  });
  return jsonOk({ ok: true });
}

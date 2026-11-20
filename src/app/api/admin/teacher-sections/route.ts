import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";

const assignSectionSchema = z.object({
  kind: z.literal("section").default("section"),
  id: z.union([z.number(), z.string()]).optional(),
  academic_session_id: z.union([z.number(), z.string()]),
  teacher_id: z.union([z.number(), z.string()]),
  section_id: z.union([z.number(), z.string()]),
  is_class_teacher: z.boolean().default(false),
});

const assignSubjectSchema = z.object({
  kind: z.literal("subject"),
  academic_session_id: z.union([z.number(), z.string()]),
  teacher_id: z.union([z.number(), z.string()]),
  section_id: z.union([z.number(), z.string()]),
  subject_id: z.union([z.number(), z.string()]),
});

export async function GET() {
  const { error } = await requireApiUser("ViewAny:TeacherSection");
  if (error) return error;

  const [sectionAssignments, subjectAssignments, sessions, teachers, sections, subjects] =
    await Promise.all([
      prisma.teacher_sections.findMany({
        include: {
          academic_sessions: true,
          teachers: true,
          class_sections: { include: { school_classes: true } },
        },
        orderBy: { id: "desc" },
      }),
      prisma.teacher_subject_assignments.findMany({
        include: {
          academic_sessions: true,
          teachers: true,
          class_sections: { include: { school_classes: true } },
          subjects: true,
        },
        orderBy: { id: "desc" },
      }),
      prisma.academic_sessions.findMany({
        where: { deleted_at: null },
        orderBy: [{ is_current: "desc" }, { start_date: "desc" }],
      }),
      prisma.teachers.findMany({
        where: { deleted_at: null, status: "active" },
        orderBy: { name: "asc" },
      }),
      prisma.class_sections.findMany({
        where: { deleted_at: null, is_active: true },
        include: { school_classes: true },
        orderBy: [{ school_classes: { sort_order: "asc" } }, { name: "asc" }],
      }),
      prisma.subjects.findMany({
        where: { deleted_at: null, is_active: true },
        orderBy: { sort_order: "asc" },
      }),
    ]);

  return jsonOk({
    sectionAssignments,
    subjectAssignments,
    sessions,
    teachers,
    sections,
    subjects,
  });
}

export async function POST(request: NextRequest) {
  const { error } = await requireApiUser("Create:TeacherSection");
  if (error) return error;

  try {
    const body = await request.json();
    const now = new Date();

    if (body?.kind === "subject") {
      const parsed = assignSubjectSchema.safeParse(body);
      if (!parsed.success) return jsonError("Invalid subject assignment.", 400);

      const assignment = await prisma.teacher_subject_assignments.create({
        data: {
          academic_session_id: toBigIntId(parsed.data.academic_session_id),
          teacher_id: toBigIntId(parsed.data.teacher_id),
          section_id: toBigIntId(parsed.data.section_id),
          subject_id: toBigIntId(parsed.data.subject_id),
          created_at: now,
          updated_at: now,
        },
      });
      return jsonOk({ assignment }, 201);
    }

    const parsed = assignSectionSchema.safeParse({ ...body, kind: "section" });
    if (!parsed.success) return jsonError("Invalid section assignment.", 400);

    const assignment = await prisma.teacher_sections.create({
      data: {
        academic_session_id: toBigIntId(parsed.data.academic_session_id),
        teacher_id: toBigIntId(parsed.data.teacher_id),
        section_id: toBigIntId(parsed.data.section_id),
        is_class_teacher: parsed.data.is_class_teacher,
        created_at: now,
        updated_at: now,
      },
    });
    return jsonOk({ assignment }, 201);
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Failed to save assignment.",
      400,
    );
  }
}

export async function PUT(request: NextRequest) {
  const { error } = await requireApiUser("Update:TeacherSection");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = assignSectionSchema.safeParse({ ...body, kind: "section" });
    if (!parsed.success || !parsed.data.id) {
      return jsonError("Invalid assignment update.", 400);
    }

    const assignment = await prisma.teacher_sections.update({
      where: { id: toBigIntId(parsed.data.id) },
      data: {
        academic_session_id: toBigIntId(parsed.data.academic_session_id),
        teacher_id: toBigIntId(parsed.data.teacher_id),
        section_id: toBigIntId(parsed.data.section_id),
        is_class_teacher: parsed.data.is_class_teacher,
        updated_at: new Date(),
      },
    });
    return jsonOk({ assignment });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to update.", 400);
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireApiUser("Delete:TeacherSection");
  if (error) return error;

  const id = request.nextUrl.searchParams.get("id");
  const kind = request.nextUrl.searchParams.get("kind") ?? "section";
  if (!id) return jsonError("Missing id.", 400);

  if (kind === "subject") {
    await prisma.teacher_subject_assignments.delete({
      where: { id: toBigIntId(id) },
    });
  } else {
    await prisma.teacher_sections.delete({ where: { id: toBigIntId(id) } });
  }
  return jsonOk({ ok: true });
}

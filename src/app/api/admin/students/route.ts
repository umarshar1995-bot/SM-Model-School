import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";

const studentSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  family_id: z.union([z.number(), z.string()]),
  admission_no: z.string().max(50).optional().nullable(),
  full_name: z.string().min(1).max(180),
  enrollment: z
    .object({
      class_id: z.union([z.number(), z.string()]),
      section_id: z.union([z.number(), z.string()]),
      roll_no: z.string().max(20).optional().nullable(),
    })
    .optional()
    .nullable(),
  gender: z.enum(["male", "female", "other"]),
  dob: z.string().min(1),
  b_form_no: z.string().max(20).optional().nullable(),
  photo_path: z.string().max(255).optional().nullable(),
  previous_school: z.string().max(180).optional().nullable(),
  admission_date: z.string().min(1),
  status: z.enum(["active", "left", "struck_off", "passed_out"]).default("active"),
});

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser("ViewAny:Student");
  if (error) return error;

  const sp = request.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const status = sp.get("status") ?? "";
  const gender = sp.get("gender") ?? "";
  const classIdParam = sp.get("classId") ?? "";
  const sectionIdParam = sp.get("sectionId") ?? "";
  const trashed = sp.get("trashed") === "1";

  const enrollmentFilter =
    classIdParam || sectionIdParam
      ? {
          student_enrollments: {
            some: {
              deleted_at: null,
              status: "active",
              ...(classIdParam ? { class_id: toBigIntId(classIdParam) } : {}),
              ...(sectionIdParam ? { section_id: toBigIntId(sectionIdParam) } : {}),
            },
          },
        }
      : {};

  const [students, families, classes, sections, currentSession] = await Promise.all([
    prisma.students.findMany({
      where: {
        deleted_at: trashed ? { not: null } : null,
        ...(status ? { status } : {}),
        ...(gender ? { gender } : {}),
        ...enrollmentFilter,
        ...(q
          ? {
              OR: [
                { full_name: { contains: q, mode: "insensitive" } },
                { admission_no: { contains: q, mode: "insensitive" } },
                { b_form_no: { contains: q, mode: "insensitive" } },
                {
                  families: {
                    guardian_name: { contains: q, mode: "insensitive" },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        families: true,
        student_enrollments: {
          where: { deleted_at: null },
          orderBy: { id: "desc" },
          take: 1,
          include: { school_classes: true, class_sections: true },
        },
      },
      orderBy: [{ admission_no: "desc" }, { id: "desc" }],
    }),
    prisma.families.findMany({
      where: { is_active: true, deleted_at: null },
      orderBy: { guardian_name: "asc" },
      select: { id: true, family_number: true, guardian_name: true, guardian_mobile: true },
    }),
    prisma.school_classes.findMany({
      where: { is_active: true, deleted_at: null },
      orderBy: { sort_order: "asc" },
      select: { id: true, name: true },
    }),
    prisma.class_sections.findMany({
      where: { is_active: true, deleted_at: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, class_id: true },
    }),
    prisma.academic_sessions.findFirst({
      where: { is_current: true, deleted_at: null },
      select: { id: true, name: true },
    }),
  ]);

  return jsonOk({ students, families, classes, sections, currentSession });
}

export async function POST(request: NextRequest) {
  const { error } = await requireApiUser("Create:Student");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = studentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Please fill all required student fields accurately.", 400);
    }

    const now = new Date();
    let admissionNo = parsed.data.admission_no?.trim() || null;
    if (!admissionNo) {
      const count = await prisma.students.count();
      const year = now.getFullYear();
      let seq = count + 1;
      admissionNo = `SM-${year}-${String(seq).padStart(3, "0")}`;
      while (await prisma.students.findFirst({ where: { admission_no: admissionNo } })) {
        seq++;
        admissionNo = `SM-${year}-${String(seq).padStart(3, "0")}`;
      }
    }

    const enrollmentInput = parsed.data.enrollment;
    let enrolled = false;

    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.students.create({
        data: {
          family_id: toBigIntId(parsed.data.family_id),
          admission_no: admissionNo,
          full_name: parsed.data.full_name.trim(),
          gender: parsed.data.gender,
          dob: new Date(parsed.data.dob),
          b_form_no: parsed.data.b_form_no?.trim() || null,
          photo_path: parsed.data.photo_path || null,
          previous_school: parsed.data.previous_school?.trim() || null,
          admission_date: new Date(parsed.data.admission_date),
          status: parsed.data.status,
          created_at: now,
          updated_at: now,
        },
        include: { families: true },
      });

      if (enrollmentInput) {
        const session = await tx.academic_sessions.findFirst({
          where: { is_current: true, deleted_at: null },
        });
        if (!session) {
          throw new Error("No current academic session is set, so the student cannot be enrolled.");
        }
        await tx.student_enrollments.create({
          data: {
            student_id: created.id,
            session_id: session.id,
            class_id: toBigIntId(enrollmentInput.class_id),
            section_id: toBigIntId(enrollmentInput.section_id),
            roll_no: enrollmentInput.roll_no?.trim() || null,
            admission_date: new Date(parsed.data.admission_date),
            status: "active",
            created_at: now,
            updated_at: now,
          },
        });
        enrolled = true;
      }
      return created;
    });

    return jsonOk({ student, enrolled }, 201);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to create student.", 400);
  }
}

export async function PUT(request: NextRequest) {
  const { error } = await requireApiUser("Update:Student");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = studentSchema.safeParse(body);
    if (!parsed.success || !parsed.data.id) {
      return jsonError("Invalid student update data.", 400);
    }

    const student = await prisma.students.update({
      where: { id: toBigIntId(parsed.data.id) },
      data: {
        family_id: toBigIntId(parsed.data.family_id),
        admission_no: parsed.data.admission_no?.trim() || null,
        full_name: parsed.data.full_name.trim(),
        gender: parsed.data.gender,
        dob: new Date(parsed.data.dob),
        b_form_no: parsed.data.b_form_no?.trim() || null,
        photo_path: parsed.data.photo_path || null,
        previous_school: parsed.data.previous_school?.trim() || null,
        admission_date: new Date(parsed.data.admission_date),
        status: parsed.data.status,
        updated_at: new Date(),
      },
      include: { families: true },
    });

    return jsonOk({ student });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to update student.", 400);
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireApiUser("Delete:Student");
  if (error) return error;

  const id = request.nextUrl.searchParams.get("id");
  const mode = request.nextUrl.searchParams.get("mode") ?? "soft";
  if (!id) return jsonError("Missing student id.", 400);

  const studentId = toBigIntId(id);
  if (mode === "restore") {
    await prisma.students.update({
      where: { id: studentId },
      data: { deleted_at: null, updated_at: new Date() },
    });
  } else if (mode === "force") {
    await prisma.students.delete({ where: { id: studentId } });
  } else {
    await prisma.students.update({
      where: { id: studentId },
      data: { deleted_at: new Date(), updated_at: new Date() },
    });
  }

  return jsonOk({ ok: true });
}

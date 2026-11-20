import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, requireApiUser } from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";
import { chargePromotionFeeIfPromoted } from "@/lib/fee-service";
import { getClientIp } from "@/lib/audit";

const enrollmentSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  student_id: z.union([z.number(), z.string()]),
  session_id: z.union([z.number(), z.string()]),
  class_id: z.union([z.number(), z.string()]),
  section_id: z.union([z.number(), z.string()]),
  roll_no: z.string().max(20).optional().nullable(),
  admission_date: z.string().optional().nullable(),
  status: z
    .enum(["active", "promoted", "left", "struck_off", "passed_out"])
    .default("active"),
});

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser("ViewAny:StudentEnrollment");
  if (error) return error;

  const sp = request.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const sessionId = sp.get("sessionId");
  const trashed = sp.get("trashed") === "1";

  const [enrollments, students, sessions, classes, sections] = await Promise.all([
    prisma.student_enrollments.findMany({
      where: {
        deleted_at: trashed ? { not: null } : null,
        ...(sessionId ? { session_id: toBigIntId(sessionId) } : {}),
        ...(q
          ? {
              OR: [
                { roll_no: { contains: q, mode: "insensitive" } },
                {
                  students: {
                    OR: [
                      { full_name: { contains: q, mode: "insensitive" } },
                      { admission_no: { contains: q, mode: "insensitive" } },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        students: { include: { families: true } },
        academic_sessions: true,
        school_classes: true,
        class_sections: true,
      },
      orderBy: { id: "desc" },
    }),
    prisma.students.findMany({
      where: { deleted_at: null },
      orderBy: { full_name: "asc" },
      select: { id: true, full_name: true, admission_no: true },
    }),
    prisma.academic_sessions.findMany({
      where: { deleted_at: null },
      orderBy: [{ is_current: "desc" }, { start_date: "desc" }],
    }),
    prisma.school_classes.findMany({
      where: { is_active: true, deleted_at: null },
      orderBy: { sort_order: "asc" },
    }),
    prisma.class_sections.findMany({
      where: { is_active: true, deleted_at: null },
      orderBy: { name: "asc" },
    }),
  ]);

  return jsonOk({ enrollments, students, sessions, classes, sections });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiUser("Create:StudentEnrollment", request);
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = enrollmentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid enrollment fields.", 400);
    }

    const studentId = toBigIntId(parsed.data.student_id);
    const sessionId = toBigIntId(parsed.data.session_id);
    const classId = toBigIntId(parsed.data.class_id);
    const now = new Date();
    const enrollment = await prisma.student_enrollments.create({
      data: {
        student_id: studentId,
        session_id: sessionId,
        class_id: classId,
        section_id: toBigIntId(parsed.data.section_id),
        roll_no: parsed.data.roll_no?.trim() || null,
        admission_date: parsed.data.admission_date
          ? new Date(parsed.data.admission_date)
          : now,
        status: parsed.data.status,
        created_at: now,
        updated_at: now,
      },
      include: {
        students: true,
        academic_sessions: true,
        school_classes: true,
        class_sections: true,
      },
    });

    // Automatically charge one-time PROMOTION fee if promoted into a higher class in a new session
    let promotionFee = null;
    try {
      promotionFee = await chargePromotionFeeIfPromoted({
        studentId,
        sessionId,
        newClassId: classId,
        enrollmentId: enrollment.id,
        actor: {
          id: user.id,
          name: user.name,
          ipAddress: getClientIp(request),
        },
      });
    } catch (promoErr) {
      console.error("Promotion fee auto-charge warning:", promoErr);
    }

    return jsonOk(
      {
        enrollment,
        promotionFeeCharged: Boolean(promotionFee),
        promotionFee,
      },
      201,
    );
  } catch (err) {
    return jsonError(
      err instanceof Error
        ? err.message.includes("Unique")
          ? "This student is already enrolled in that academic session."
          : err.message
        : "Failed to enroll student.",
      400,
    );
  }
}

export async function PUT(request: NextRequest) {
  const { error } = await requireApiUser("Update:StudentEnrollment");
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = enrollmentSchema.safeParse(body);
    if (!parsed.success || !parsed.data.id) {
      return jsonError("Invalid enrollment update data.", 400);
    }

    const enrollment = await prisma.student_enrollments.update({
      where: { id: toBigIntId(parsed.data.id) },
      data: {
        student_id: toBigIntId(parsed.data.student_id),
        session_id: toBigIntId(parsed.data.session_id),
        class_id: toBigIntId(parsed.data.class_id),
        section_id: toBigIntId(parsed.data.section_id),
        roll_no: parsed.data.roll_no?.trim() || null,
        admission_date: parsed.data.admission_date
          ? new Date(parsed.data.admission_date)
          : null,
        status: parsed.data.status,
        updated_at: new Date(),
      },
    });

    return jsonOk({ enrollment });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Failed to update enrollment.",
      400,
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { error } = await requireApiUser("Delete:StudentEnrollment");
  if (error) return error;

  const id = request.nextUrl.searchParams.get("id");
  const mode = request.nextUrl.searchParams.get("mode") ?? "soft";
  if (!id) return jsonError("Missing enrollment id.", 400);

  const eid = toBigIntId(id);
  if (mode === "restore") {
    await prisma.student_enrollments.update({
      where: { id: eid },
      data: { deleted_at: null, updated_at: new Date() },
    });
  } else if (mode === "force") {
    await prisma.student_enrollments.delete({ where: { id: eid } });
  } else {
    await prisma.student_enrollments.update({
      where: { id: eid },
      data: { deleted_at: new Date(), updated_at: new Date() },
    });
  }
  return jsonOk({ ok: true });
}

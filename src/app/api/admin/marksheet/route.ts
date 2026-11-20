import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonOk, requireApiUser } from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser();
  if (error) return error;

  const sp = request.nextUrl.searchParams;
  const studentParam = sp.get("studentId");
  const sessionParam = sp.get("sessionId");

  const [students, sessions] = await Promise.all([
    prisma.students.findMany({
      where: { status: "active", deleted_at: null },
      orderBy: { full_name: "asc" },
      select: { id: true, full_name: true, admission_no: true },
    }),
    prisma.academic_sessions.findMany({
      where: { deleted_at: null },
      orderBy: [{ is_current: "desc" }, { start_date: "desc" }],
    }),
  ]);

  const selectedStudentId = studentParam
    ? toBigIntId(studentParam)
    : students[0]?.id ?? null;
  const selectedSessionId = sessionParam
    ? toBigIntId(sessionParam)
    : sessions.find((s) => s.is_current)?.id ?? sessions[0]?.id ?? null;

  const student = selectedStudentId
    ? await prisma.students.findFirst({
        where: { id: selectedStudentId, deleted_at: null },
        include: { families: true },
      })
    : null;

  let enrollment = null;
  if (selectedStudentId) {
    enrollment =
      (selectedSessionId
        ? await prisma.student_enrollments.findFirst({
            where: {
              student_id: selectedStudentId,
              session_id: selectedSessionId,
              deleted_at: null,
            },
            include: {
              school_classes: true,
              class_sections: true,
              academic_sessions: true,
            },
          })
        : null) ??
      (await prisma.student_enrollments.findFirst({
        where: { student_id: selectedStudentId, deleted_at: null },
        orderBy: { id: "desc" },
        include: {
          school_classes: true,
          class_sections: true,
          academic_sessions: true,
        },
      }));
  }

  const session =
    sessions.find((s) => selectedSessionId && s.id === selectedSessionId) ??
    enrollment?.academic_sessions ??
    null;

  return jsonOk({
    students,
    sessions,
    selectedStudentId,
    selectedSessionId,
    student,
    enrollment,
    session,
  });
}

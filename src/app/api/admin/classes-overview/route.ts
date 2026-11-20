import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonOk, requireApiUser } from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser("ViewAny:SchoolClass");
  if (error) return error;

  const sessionParam = request.nextUrl.searchParams.get("sessionId");

  const sessions = await prisma.academic_sessions.findMany({
    where: { deleted_at: null },
    orderBy: [{ is_current: "desc" }, { start_date: "desc" }],
  });

  const selectedSession = sessionParam
    ? sessions.find((s) => String(s.id) === sessionParam) ?? sessions[0] ?? null
    : sessions.find((s) => s.is_current) ?? sessions[0] ?? null;

  const classes = await prisma.school_classes.findMany({
    where: { is_active: true, deleted_at: null },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    include: {
      class_sections: {
        where: { is_active: true, deleted_at: null },
        orderBy: { name: "asc" },
        include: {
          users: { select: { id: true, name: true } },
        },
      },
      student_enrollments: {
        where: {
          deleted_at: null,
          status: "active",
          ...(selectedSession ? { session_id: toBigIntId(selectedSession.id) } : {}),
        },
        include: {
          students: {
            select: {
              id: true,
              full_name: true,
              gender: true,
              photo_path: true,
              deleted_at: true,
            },
          },
        },
      },
    },
  });

  const cards = classes.map((cls) => {
    const activeEnrollments = cls.student_enrollments.filter(
      (e) => e.students && !e.students.deleted_at,
    );
    const totalStudents = activeEnrollments.length;
    const boysCount = activeEnrollments.filter(
      (e) => e.students?.gender === "male",
    ).length;
    const girlsCount = activeEnrollments.filter(
      (e) => e.students?.gender === "female",
    ).length;

    const totalCapacity = cls.class_sections.reduce(
      (sum, sec) => sum + (sec.capacity ?? 0),
      0,
    );
    const occupancyPercent =
      totalCapacity > 0
        ? Math.min(100, Math.round((totalStudents / totalCapacity) * 100))
        : 0;

    const sectionStats = cls.class_sections.map((sec) => ({
      id: sec.id,
      name: sec.name,
      capacity: sec.capacity,
      classTeacher: sec.users?.name ?? null,
      count: activeEnrollments.filter((e) => e.section_id === sec.id).length,
    }));

    const previewAvatars = activeEnrollments.slice(0, 4).map((e) => ({
      id: e.students!.id,
      full_name: e.students!.full_name,
      photo_path: e.students!.photo_path,
    }));

    return {
      id: cls.id,
      name: cls.name,
      sort_order: cls.sort_order,
      totalStudents,
      boysCount,
      girlsCount,
      totalCapacity,
      occupancyPercent,
      sections: sectionStats,
      previewAvatars,
    };
  });

  const summary = {
    totalClasses: cards.length,
    totalStudents: cards.reduce((s, c) => s + c.totalStudents, 0),
    totalSections: cards.reduce((s, c) => s + c.sections.length, 0),
    activeClassesWithStudents: cards.filter((c) => c.totalStudents > 0).length,
  };

  return jsonOk({
    sessions,
    selectedSession,
    summary,
    classes: cards,
  });
}

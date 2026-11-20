import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonOk, requireApiUser } from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser();
  if (error) return error;

  const sp = request.nextUrl.searchParams;
  const sessionParam = sp.get("sessionId");
  const classParam = sp.get("classId");
  const sectionParam = sp.get("sectionId");
  const searchQuery = (sp.get("q") ?? "").trim();
  const student360Param = sp.get("studentId");

  const [sessions, classes] = await Promise.all([
    prisma.academic_sessions.findMany({
      where: { deleted_at: null },
      orderBy: [{ is_current: "desc" }, { start_date: "desc" }],
    }),
    prisma.school_classes.findMany({
      where: { is_active: true, deleted_at: null },
      orderBy: { sort_order: "asc" },
      include: {
        class_sections: {
          where: { is_active: true, deleted_at: null },
          orderBy: { name: "asc" },
          include: { users: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  const selectedSessionId = sessionParam
    ? toBigIntId(sessionParam)
    : sessions.find((s) => s.is_current)?.id ?? sessions[0]?.id ?? null;

  let selectedClassId: bigint | null = null;
  if (classParam && classParam !== "all") {
    selectedClassId = toBigIntId(classParam);
  } else if (!classParam) {
    const firstWithSections = classes.find((c) => c.class_sections.length > 0);
    selectedClassId = firstWithSections?.id ?? classes[0]?.id ?? null;
  }

  const currentClass =
    classes.find((c) => selectedClassId !== null && c.id === selectedClassId) ?? null;
  const sections = currentClass?.class_sections ?? [];

  let selectedSectionId: bigint | null = null;
  if (sectionParam && sectionParam !== "all") {
    const candidate = toBigIntId(sectionParam);
    if (sections.some((s) => s.id === candidate)) {
      selectedSectionId = candidate;
    }
  } else if (sectionParam === null && sections.length > 0) {
    selectedSectionId = sections[0].id;
  }

  const currentSection =
    sections.find((s) => selectedSectionId !== null && s.id === selectedSectionId) ??
    null;

  const numericSearch = /^\d+$/.test(searchQuery) ? BigInt(searchQuery) : null;

  const enrollments =
    selectedSessionId && selectedClassId
      ? await prisma.student_enrollments.findMany({
          where: {
            deleted_at: null,
            session_id: selectedSessionId,
            class_id: selectedClassId,
            ...(selectedSectionId ? { section_id: selectedSectionId } : {}),
            ...(searchQuery
              ? {
                  OR: [
                    { roll_no: { contains: searchQuery, mode: "insensitive" } },
                    {
                      students: {
                        OR: [
                          { full_name: { contains: searchQuery, mode: "insensitive" } },
                          { admission_no: { contains: searchQuery, mode: "insensitive" } },
                          { b_form_no: { contains: searchQuery, mode: "insensitive" } },
                          {
                            families: {
                              OR: [
                                {
                                  guardian_name: {
                                    contains: searchQuery,
                                    mode: "insensitive",
                                  },
                                },
                                ...(numericSearch
                                  ? [{ family_number: numericSearch }]
                                  : []),
                              ],
                            },
                          },
                        ],
                      },
                    },
                  ],
                }
              : {}),
          },
          include: {
            students: { include: { families: true } },
            school_classes: true,
            class_sections: true,
          },
          orderBy: [{ roll_no: "asc" }, { id: "asc" }],
        })
      : [];

  const totalStudents = enrollments.length;
  const boysCount = enrollments.filter((e) => e.students?.gender === "male").length;
  const girlsCount = enrollments.filter((e) => e.students?.gender === "female").length;
  const capacity = currentSection?.capacity ?? 0;
  const occupancyPercent =
    capacity > 0 ? Math.min(100, Math.round((totalStudents / capacity) * 100)) : 0;

  let student360 = null;
  if (student360Param) {
    const sid = toBigIntId(student360Param);
    const activeStudent = await prisma.students.findFirst({
      where: { id: sid, deleted_at: null },
      include: {
        families: {
          include: {
            family_fee_challans: {
              where: { deleted_at: null },
              orderBy: { id: "desc" },
              take: 1,
            },
          },
        },
        student_leaves: {
          where: { deleted_at: null },
          orderBy: { start_date: "desc" },
        },
        student_fees: {
          where: { deleted_at: null },
          orderBy: { due_date: "desc" },
        },
        student_enrollments: {
          where: { deleted_at: null },
          include: {
            school_classes: true,
            class_sections: true,
            academic_sessions: true,
          },
          orderBy: { id: "desc" },
        },
      },
    });

    if (activeStudent) {
      const siblings = await prisma.students.findMany({
        where: {
          family_id: activeStudent.family_id,
          id: { not: activeStudent.id },
          deleted_at: null,
        },
        include: {
          student_enrollments: {
            where: { deleted_at: null },
            orderBy: { id: "desc" },
            take: 1,
            include: { school_classes: true, class_sections: true },
          },
        },
      });

      const activeEnrollment =
        activeStudent.student_enrollments.find(
          (e) => selectedSessionId && e.session_id === selectedSessionId,
        ) ??
        activeStudent.student_enrollments[0] ??
        null;

      student360 = {
        student: activeStudent,
        enrollment: activeEnrollment,
        siblings,
        leaves: activeStudent.student_leaves,
        fees: activeStudent.student_fees,
        latestFamilyChallanId:
          activeStudent.families?.family_fee_challans?.[0]?.id ?? null,
      };
    }
  }

  return jsonOk({
    sessions,
    classes,
    sections,
    selectedSessionId,
    selectedClassId,
    selectedSectionId,
    currentClass,
    currentSection,
    enrollments,
    stats: {
      totalStudents,
      boysCount,
      girlsCount,
      capacity,
      occupancyPercent,
      classTeacherName: currentSection?.users?.name ?? "Not Assigned",
    },
    student360,
  });
}

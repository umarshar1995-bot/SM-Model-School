import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonOk, requireApiUser } from "@/lib/api-helpers";
import { toBigIntId } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  const { error } = await requireApiUser();
  if (error) return error;

  const sessionParam = request.nextUrl.searchParams.get("sessionId");
  const chartFilter = request.nextUrl.searchParams.get("chartFilter") ?? "current";

  const sessions = await prisma.academic_sessions.findMany({
    where: { deleted_at: null },
    orderBy: [{ is_current: "desc" }, { start_date: "desc" }],
  });

  const selectedSession = sessionParam
    ? sessions.find((s) => String(s.id) === sessionParam) ?? sessions[0] ?? null
    : sessions.find((s) => s.is_current) ?? sessions[0] ?? null;

  const lastSession =
    sessions.find((s) => !s.is_current) ?? selectedSession ?? null;

  const chartSession = chartFilter === "last" ? lastSession : selectedSession;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [
    totalStudents,
    maleStudents,
    femaleStudents,
    totalTeachers,
    totalClasses,
    totalFamilies,
    enrolledInSession,
    newEnrollmentsThisMonth,
    recentEnrollments,
    feeChallans,
    sessionEnrollmentsForChart,
    classDistribution,
  ] = await Promise.all([
    prisma.students.count({ where: { status: "active", deleted_at: null } }),
    prisma.students.count({
      where: { status: "active", gender: "male", deleted_at: null },
    }),
    prisma.students.count({
      where: { status: "active", gender: "female", deleted_at: null },
    }),
    prisma.teachers.count({ where: { status: "active", deleted_at: null } }),
    prisma.school_classes.count({
      where: { is_active: true, deleted_at: null },
    }),
    prisma.families.count({ where: { is_active: true, deleted_at: null } }),
    selectedSession
      ? prisma.student_enrollments.count({
          where: {
            session_id: selectedSession.id,
            status: "active",
            deleted_at: null,
          },
        })
      : Promise.resolve(0),
    selectedSession
      ? prisma.student_enrollments.count({
          where: {
            session_id: selectedSession.id,
            deleted_at: null,
            created_at: { gte: monthStart, lt: nextMonthStart },
          },
        })
      : Promise.resolve(0),
    prisma.student_enrollments.findMany({
      where: {
        status: "active",
        deleted_at: null,
        ...(selectedSession ? { session_id: selectedSession.id } : {}),
      },
      include: {
        students: { include: { families: true } },
        school_classes: true,
        class_sections: true,
        academic_sessions: true,
      },
      orderBy: { id: "desc" },
      take: 10,
    }),
    prisma.family_fee_challans.findMany({
      where: {
        deleted_at: null,
        ...(selectedSession ? { academic_session_id: selectedSession.id } : {}),
      },
      select: {
        payable_before_due: true,
        paid_amount: true,
        status: true,
      },
    }),
    chartSession
      ? prisma.student_enrollments.findMany({
          where: {
            session_id: toBigIntId(chartSession.id),
            deleted_at: null,
          },
          select: { created_at: true, admission_date: true },
        })
      : Promise.resolve([]),
    prisma.school_classes.findMany({
      where: { is_active: true, deleted_at: null },
      orderBy: { sort_order: "asc" },
      include: {
        _count: {
          select: {
            student_enrollments: {
              where: {
                deleted_at: null,
                status: "active",
                ...(selectedSession ? { session_id: selectedSession.id } : {}),
              },
            },
          },
        },
      },
    }),
  ]);

  // Aggregate monthly trend
  const monthBuckets = new Map<string, number>();
  for (const row of sessionEnrollmentsForChart) {
    const dt = row.admission_date ?? row.created_at;
    if (!dt) continue;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + 1);
  }

  let enrollmentTrends = Array.from(monthBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, count]) => {
      const [y, m] = ym.split("-").map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      return { month: label, enrollments: count };
    });

  if (enrollmentTrends.length === 0) {
    enrollmentTrends = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ].map((month) => ({ month, enrollments: 0 }));
  }

  const totalBilled = feeChallans.reduce(
    (sum, c) => sum + Number(c.payable_before_due),
    0,
  );
  const totalCollected = feeChallans.reduce(
    (sum, c) => sum + Number(c.paid_amount),
    0,
  );
  const totalOutstanding = feeChallans.reduce(
    (sum, c) => sum + Math.max(0, Number(c.payable_before_due) - Number(c.paid_amount)),
    0,
  );

  return jsonOk({
    sessions,
    selectedSession,
    stats: {
      totalStudents,
      maleStudents,
      femaleStudents,
      totalTeachers,
      totalClasses,
      totalFamilies,
      enrolledInSession,
      newEnrollmentsThisMonth,
      totalBilled,
      totalCollected,
      totalOutstanding,
      recoveryRate:
        totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 1000) / 10 : 0,
    },
    enrollmentTrends,
    classDistribution: classDistribution
      .filter((c) => c._count.student_enrollments > 0)
      .map((c) => ({
        name: c.name,
        students: c._count.student_enrollments,
      })),
    recentEnrollments,
  });
}

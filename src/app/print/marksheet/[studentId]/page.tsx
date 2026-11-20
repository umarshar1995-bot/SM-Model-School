import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toBigIntId } from "@/lib/serialize";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { MarksheetDocument } from "@/components/reports/MarksheetDocument";

export const dynamic = "force-dynamic";

export default async function PrintMarksheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ session_id?: string; autoprint?: string }>;
}) {
  const { studentId } = await params;
  const sp = await searchParams;

  let sid: bigint;
  try {
    sid = toBigIntId(studentId);
  } catch {
    notFound();
  }

  const student = await prisma.students.findFirst({
    where: { id: sid, deleted_at: null },
    include: {
      families: true,
      student_enrollments: {
        where: { deleted_at: null },
        orderBy: { id: "desc" },
        include: {
          school_classes: true,
          class_sections: true,
          academic_sessions: true,
        },
      },
    },
  });

  if (!student) notFound();

  const session = sp.session_id
    ? await prisma.academic_sessions.findUnique({
        where: { id: toBigIntId(sp.session_id) },
      })
    : (await prisma.academic_sessions.findFirst({
        where: { is_current: true, deleted_at: null },
      })) ??
      (await prisma.academic_sessions.findFirst({ where: { deleted_at: null } }));

  const enrollment =
    student.student_enrollments.find(
      (e) => session && e.session_id === session.id,
    ) ??
    student.student_enrollments[0] ??
    null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 py-6 px-4 flex flex-col items-center">
      <style>{`@page { size: A4 portrait; margin: 8mm; }`}</style>

      <PrintToolbar
        title="Academic Marksheet & Progress Report"
        subtitle={`${student.full_name} • ${enrollment?.school_classes?.name ?? "Class"} (${enrollment?.class_sections?.name ?? "Section"}) • Roll #${enrollment?.roll_no ?? "—"}`}
        actionLabel="Print Marksheet"
        autoprint={sp.autoprint === "1" || sp.autoprint === "true"}
        maxWidthClass="max-w-4xl"
      />

      <div className="w-full">
        <MarksheetDocument
          student={{
            full_name: student.full_name,
            admission_no: student.admission_no,
            dob: student.dob,
            b_form_no: student.b_form_no,
            family: student.families
              ? {
                  guardian_name: student.families.guardian_name,
                  family_number: Number(student.families.family_number),
                }
              : null,
          }}
          enrollment={
            enrollment
              ? {
                  roll_no: enrollment.roll_no,
                  schoolClass: enrollment.school_classes,
                  section: enrollment.class_sections,
                }
              : null
          }
          session={session}
        />
      </div>
    </div>
  );
}

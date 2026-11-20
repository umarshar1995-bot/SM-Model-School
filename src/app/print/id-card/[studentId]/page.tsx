import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toBigIntId } from "@/lib/serialize";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { CardRenderer } from "@/components/cards/CardRenderer";

export const dynamic = "force-dynamic";

export default async function PrintIdCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ autoprint?: string; template?: string }>;
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
        include: { school_classes: true, class_sections: true },
      },
    },
  });

  if (!student) notFound();

  const currentSession = await prisma.academic_sessions.findFirst({
    where: { is_current: true, deleted_at: null },
  });

  const enrollment =
    student.student_enrollments.find(
      (e) => currentSession && e.session_id === currentSession.id,
    ) ??
    student.student_enrollments[0] ??
    null;

  const template =
    (sp.template
      ? await prisma.card_templates.findFirst({
          where: { slug: sp.template, deleted_at: null },
        })
      : null) ??
    (await prisma.card_templates.findFirst({
      where: { is_active: true, is_default: true, deleted_at: null },
      orderBy: { id: "desc" },
    })) ??
    (await prisma.card_templates.findFirst({
      where: { slug: "prestige-gold", deleted_at: null },
    })) ??
    (await prisma.card_templates.findFirst({ where: { deleted_at: null } }));

  const templateData = template
    ? {
        slug: template.slug,
        name: template.name,
        template_type: template.template_type,
        orientation: template.orientation,
        settings: (template.settings as Record<string, unknown> | null) ?? null,
      }
    : {
        slug: "prestige-gold",
        name: "Prestige Gold & Sapphire",
        template_type: "student",
        orientation: "portrait",
        settings: null,
      };

  const cardStudent = {
    full_name: student.full_name,
    admission_no: student.admission_no,
    photo_path: student.photo_path,
    family: student.families
      ? {
          family_number: Number(student.families.family_number),
          guardian_name: student.families.guardian_name,
          guardian_mobile: student.families.guardian_mobile,
          address: student.families.address,
        }
      : null,
    className: enrollment?.school_classes?.name ?? null,
    sectionName: enrollment?.class_sections?.name ?? null,
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 py-8 px-4 flex flex-col items-center">
      <style>{`@page { size: A4 portrait; margin: 10mm; }`}</style>

      <PrintToolbar
        title="Student Identity Card"
        subtitle={`${student.full_name} • Roll #${enrollment?.roll_no ?? "—"} • ${enrollment?.school_classes?.name ?? "Class"} (${enrollment?.class_sections?.name ?? "Section"})`}
        actionLabel="Print ID Card"
        autoprint={sp.autoprint === "1" || sp.autoprint === "true"}
        maxWidthClass="max-w-[800px]"
      />

      <div className="flex flex-wrap items-center justify-center gap-8 p-6 bg-white rounded-3xl shadow-xl border border-slate-200">
        <div className="flex flex-col items-center">
          <p className="no-print text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            Front Side
          </p>
          <CardRenderer
            template={templateData}
            side="front"
            student={cardStudent}
            cardNumber={student.admission_no ?? `CARD-${student.id}`}
          />
        </div>

        <div className="flex flex-col items-center">
          <p className="no-print text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            Back Side
          </p>
          <CardRenderer
            template={templateData}
            side="back"
            student={cardStudent}
            cardNumber={student.admission_no ?? `CARD-${student.id}`}
          />
        </div>
      </div>
    </div>
  );
}

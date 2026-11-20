import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toBigIntId } from "@/lib/serialize";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { CardRenderer } from "@/components/cards/CardRenderer";

export const dynamic = "force-dynamic";

export default async function PrintSectionCardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sectionId: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const { sectionId } = await params;
  const sp = await searchParams;

  let secId: bigint;
  try {
    secId = toBigIntId(sectionId);
  } catch {
    notFound();
  }

  const section = await prisma.class_sections.findFirst({
    where: { id: secId, deleted_at: null },
    include: {
      school_classes: true,
      student_enrollments: {
        where: { status: "active", deleted_at: null },
        include: {
          students: { include: { families: true } },
        },
        orderBy: [{ roll_no: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!section) notFound();

  const template =
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

  const students = section.student_enrollments
    .map((e) => e.students)
    .filter((s): s is NonNullable<typeof s> => Boolean(s && !s.deleted_at));

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 py-6 px-4">
      <style>{`@page { size: A4 portrait; margin: 8mm; }`}</style>

      <PrintToolbar
        title={`Batch ID Cards • ${section.school_classes.name} (${section.name})`}
        subtitle={`${students.length} Active Student Card(s) Ready to Print`}
        actionLabel="Print All Cards"
        autoprint={sp.autoprint === "1" || sp.autoprint === "true"}
        maxWidthClass="max-w-[1050px]"
        badge={
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-blue-100 text-blue-700 font-black text-sm">
            {students.length}
          </span>
        }
      />

      <div className="max-w-[1100px] mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center">
        {students.length === 0 ? (
          <div className="col-span-full py-16 text-center text-sm text-slate-400">
            No active students enrolled in this section.
          </div>
        ) : (
          students.map((st) => (
            <div
              key={Number(st.id)}
              className="bg-white p-2.5 rounded-2xl shadow-md border border-slate-200 flex flex-col items-center break-inside-avoid"
            >
              <CardRenderer
                template={templateData}
                side="front"
                student={{
                  full_name: st.full_name,
                  admission_no: st.admission_no,
                  photo_path: st.photo_path,
                  family: st.families
                    ? {
                        family_number: Number(st.families.family_number),
                        guardian_name: st.families.guardian_name,
                        guardian_mobile: st.families.guardian_mobile,
                        address: st.families.address,
                      }
                    : null,
                  className: section.school_classes.name,
                  sectionName: section.name,
                }}
                cardNumber={st.admission_no ?? `CARD-${st.id}`}
              />
              <p className="no-print mt-2 text-center text-[11px] font-bold text-slate-600">
                {st.full_name}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

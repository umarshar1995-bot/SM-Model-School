import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toBigIntId } from "@/lib/serialize";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { formatDate, formatDateOrdinal } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PrintLeavingCertificatePage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ autoprint?: string }>;
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

  const year = new Date().getFullYear();
  const certNo = `SLC-${year}-${String(student.id).padStart(4, "0")}`;
  const dobFigures = student.dob
    ? `${String(student.dob.getDate()).padStart(2, "0")}-${String(
        student.dob.getMonth() + 1,
      ).padStart(2, "0")}-${student.dob.getFullYear()}`
    : "—";

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 py-6 px-4 flex flex-col items-center justify-center">
      <style>{`@page { size: A4 landscape; margin: 8mm; }`}</style>

      <PrintToolbar
        title="School Leaving Certificate (SLC)"
        subtitle={`Official Transfer Document • Student: ${student.full_name}`}
        actionLabel="Print Certificate"
        autoprint={sp.autoprint === "1" || sp.autoprint === "true"}
        maxWidthClass="max-w-[1080px]"
      />

      <main className="relative w-[287mm] max-w-[1080px] bg-white border-[6px] border-double border-blue-950 p-8 shadow-2xl rounded-sm overflow-hidden">
        <div className="relative border-2 border-amber-600/60 p-6 rounded-sm bg-gradient-to-b from-amber-50/20 via-white to-amber-50/20">
          {/* Subtle Watermark */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none">
            <svg className="w-[420px] h-[420px] text-blue-900" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>

          {/* 1. INSTITUTION HEADER */}
          <header className="relative flex items-center justify-between border-b-2 border-blue-900/40 pb-4 mb-5">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full border-2 border-amber-500/80 bg-blue-900 flex items-center justify-center text-amber-300 shadow-md">
                <svg className="w-11 h-11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-amber-700">
                  Govt. Registered & Affiliated
                </p>
                <h2 className="font-cinzel text-3xl font-black text-blue-950 tracking-wider">
                  SM PUBLIC SCHOOL
                </h2>
                <p className="text-xs text-slate-600 font-medium tracking-wide">
                  Campus: Airport Road, Sector 7, Sukkur, Sindh • Tel: (071) 580-2914
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="inline-block bg-blue-950 text-amber-300 font-cinzel font-bold text-xs tracking-widest px-4 py-1 rounded-sm shadow-sm">
                ORIGINAL COPY
              </div>
              <div className="mt-2 text-xs text-slate-700 space-y-0.5">
                <p>
                  <span className="text-slate-500 font-semibold">Certificate No: </span>
                  <strong className="font-mono text-blue-950 text-sm">{certNo}</strong>
                </p>
                <p>
                  <span className="text-slate-500 font-semibold">Date of Issue: </span>
                  <strong className="text-slate-900">{formatDate(new Date(), true)}</strong>
                </p>
              </div>
            </div>
          </header>

          {/* 2. TITLE */}
          <div className="text-center my-3">
            <h3 className="font-cinzel text-2xl font-black text-blue-950 tracking-[0.15em] uppercase border-b-2 border-amber-500 inline-block px-8 pb-1">
              School Leaving & Character Certificate
            </h3>
          </div>

          {/* 3. BODY */}
          <div className="my-5 text-sm text-slate-800 leading-relaxed font-playfair space-y-4 px-2">
            <p className="indent-6">
              This is to certify that{" "}
              <span className="font-sans font-extrabold text-blue-950 text-base underline decoration-amber-500 underline-offset-4">
                {student.full_name}
              </span>
              ,{" "}
              Son / Daughter of{" "}
              <span className="font-sans font-bold text-slate-900 text-sm underline decoration-slate-400 underline-offset-4">
                {student.families?.guardian_name ?? "—"}
              </span>
              , bearing Family Registration No.{" "}
              <span className="font-sans font-mono font-bold text-slate-900">
                FAM-{student.families ? Number(student.families.family_number) : "—"}
              </span>
              , resident of{" "}
              <span className="font-sans font-medium text-slate-900">
                {student.families?.address ?? "Sukkur, Sindh"}
              </span>
              , was a bonafide student of this institution.
            </p>

            <div className="grid grid-cols-2 gap-x-8 gap-y-3 font-sans text-xs bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
              <div>
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] block">
                  General Admission No:
                </span>
                <strong className="font-mono text-sm text-blue-900">
                  {student.admission_no ?? "—"}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] block">
                  Admission Date:
                </span>
                <strong className="text-slate-900">
                  {formatDate(student.admission_date, true)}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] block">
                  Date of Birth (in Figures):
                </span>
                <strong className="text-slate-900 font-mono">{dobFigures}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] block">
                  Date of Birth (in Words):
                </span>
                <strong className="text-slate-800 italic">
                  {formatDateOrdinal(student.dob)}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] block">
                  Class & Section at Leaving:
                </span>
                <strong className="text-blue-950 font-bold">
                  {enrollment?.school_classes?.name ?? "—"} —{" "}
                  {enrollment?.class_sections?.name ?? "—"}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] block">
                  Class Roll Number:
                </span>
                <strong className="text-slate-900 font-mono font-bold">
                  {enrollment?.roll_no ?? "—"}
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 font-sans text-xs pt-1">
              <div className="border-l-2 border-blue-900 pl-3">
                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">
                  Clearance of School Dues
                </span>
                <span className="font-bold text-emerald-700">
                  Cleared (All Dues Paid in Full)
                </span>
              </div>
              <div className="border-l-2 border-blue-900 pl-3">
                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">
                  Character & Conduct
                </span>
                <span className="font-bold text-blue-900">Exemplary & Diligent</span>
              </div>
              <div className="border-l-2 border-blue-900 pl-3">
                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">
                  Reason for Leaving
                </span>
                <span className="font-bold text-slate-800">
                  Parents Relocation / Transfer
                </span>
              </div>
            </div>
          </div>

          {/* 4. SIGNATURES */}
          <footer className="mt-8 pt-4 border-t border-slate-300 grid grid-cols-3 gap-8 text-center font-sans">
            <div>
              <div className="h-10" />
              <div className="border-t border-slate-700 mx-auto w-40 pt-1">
                <p className="text-xs font-bold text-slate-800">Class Incharge</p>
                <p className="text-[10px] text-slate-500">Teacher Signature</p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-end">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-blue-900/40 flex items-center justify-center text-[9px] text-blue-900/60 uppercase font-black tracking-widest text-center px-1">
                School Seal / Stamp
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Official Registry Stamp</p>
            </div>

            <div>
              <div className="h-10" />
              <div className="border-t border-slate-700 mx-auto w-40 pt-1">
                <p className="text-xs font-bold text-blue-950">Principal / Headmaster</p>
                <p className="text-[10px] text-slate-500">Authorized Signatory</p>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}

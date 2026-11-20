import React from "react";
import { formatDate } from "@/lib/format";

export interface MarksheetSubjectRow {
  code: string;
  name: string;
  max: number;
  pass: number;
  obtained: number;
  grade: string;
  remarks: string;
}

export interface MarksheetDocumentProps {
  student?: {
    full_name?: string | null;
    admission_no?: string | null;
    dob?: string | Date | null;
    b_form_no?: string | null;
    family?: {
      guardian_name?: string | null;
      family_number?: number | string | null;
    } | null;
  } | null;
  enrollment?: {
    roll_no?: string | null;
    schoolClass?: { name?: string | null } | null;
    section?: { name?: string | null } | null;
  } | null;
  session?: { name?: string | null } | null;
  subjects?: MarksheetSubjectRow[];
}

const DEFAULT_SUBJECTS: MarksheetSubjectRow[] = [
  { code: "ENG-8", name: "English Language & Lit", max: 100, pass: 40, obtained: 88, grade: "A+", remarks: "Excellent" },
  { code: "URD-8", name: "Urdu Compulsory", max: 100, pass: 40, obtained: 82, grade: "A+", remarks: "Very Good" },
  { code: "MTH-8", name: "Mathematics", max: 100, pass: 40, obtained: 95, grade: "A+", remarks: "Outstanding" },
  { code: "SCI-8", name: "General Science", max: 100, pass: 40, obtained: 86, grade: "A+", remarks: "Excellent" },
  { code: "SST-8", name: "Social Studies / History", max: 100, pass: 40, obtained: 78, grade: "A", remarks: "Good" },
  { code: "ISL-8", name: "Islamiat Compulsory", max: 100, pass: 40, obtained: 92, grade: "A+", remarks: "Outstanding" },
];

function computeGrade(pct: number): { grade: string; status: string } {
  if (pct >= 80) return { grade: "A+", status: "Passed with Distinction" };
  if (pct >= 70) return { grade: "A", status: "Passed with Honors" };
  if (pct >= 60) return { grade: "B", status: "Passed" };
  if (pct >= 50) return { grade: "C", status: "Passed" };
  if (pct >= 40) return { grade: "D", status: "Passed" };
  return { grade: "F", status: "Needs Improvement" };
}

export function MarksheetDocument({
  student,
  enrollment,
  session,
  subjects,
}: MarksheetDocumentProps) {
  const rows = subjects && subjects.length > 0 ? subjects : DEFAULT_SUBJECTS;
  const totalMax = rows.reduce((sum, s) => sum + s.max, 0);
  const totalObtained = rows.reduce((sum, s) => sum + s.obtained, 0);
  const overallPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 1000) / 10 : 0;
  const { grade: overallGrade, status: resultHeadline } = computeGrade(overallPct);
  const passed = overallPct >= 40;

  return (
    <main className="marksheet-card max-w-4xl mx-auto bg-white text-slate-800 rounded-2xl shadow-xl border border-slate-200 p-8 sm:p-12 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-900" />

      {/* 1. HEADER */}
      <header className="border-b-2 border-slate-900 pb-6 mb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-blue-950 flex items-center justify-center text-amber-400 font-black text-2xl shadow-md border-2 border-amber-400/40 shrink-0">
              SM
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-blue-950">
                Shabiran Mustafa Public School
              </h1>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mt-0.5">
                Hindyari, Sukkur • Registered & Recognized
              </p>
              <p className="text-[11px] font-medium text-slate-600">
                Affiliated with BISE Sukkur • Board Reg No: SMPS-2010/SKR
              </p>
            </div>
          </div>
          <div className="text-center sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
            <span className="inline-block bg-blue-950 text-amber-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-1">
              Official Document
            </span>
            <p className="text-xs font-bold text-slate-700">
              Academic Year: {session?.name ?? "2025-2026"}
            </p>
            <p className="text-xs font-medium text-slate-500">
              Issue Date: {formatDate(new Date())}
            </p>
          </div>
        </div>

        <div className="mt-6 text-center bg-slate-900 text-white py-2 rounded-lg shadow-sm">
          <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-amber-300">
            Annual Examination Progress Report Card & Marksheet
          </h2>
        </div>
      </header>

      {/* 2. STUDENT INFORMATION */}
      <section className="mb-6 bg-slate-50 rounded-xl p-5 border border-slate-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 text-xs">
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Student Name
            </span>
            <span className="font-extrabold text-slate-900 text-sm">
              {student?.full_name ?? "Muhammed Ali Khan"}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Admission No
            </span>
            <span className="font-mono font-bold text-blue-800 text-sm">
              {student?.admission_no ?? "SM-2025-084"}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Class & Section
            </span>
            <span className="font-bold text-slate-900 text-sm">
              {enrollment?.schoolClass?.name ?? "Class 8"} ({enrollment?.section?.name ?? "Section A"})
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Roll Number
            </span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              {enrollment?.roll_no ?? "18"}
            </span>
          </div>

          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Father / Guardian
            </span>
            <span className="font-semibold text-slate-800">
              {student?.family?.guardian_name ?? "Tariq Mehmood Khan"}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Family ID
            </span>
            <span className="font-mono font-semibold text-slate-800">
              {student?.family?.family_number ? `FAM-${student.family.family_number}` : "FAM-1042"}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Date of Birth
            </span>
            <span className="font-semibold text-slate-800">
              {student?.dob ? formatDate(student.dob) : "14 Aug 2012"}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              B-Form / CNIC
            </span>
            <span className="font-mono font-semibold text-slate-800">
              {student?.b_form_no ?? "45203-1234567-1"}
            </span>
          </div>
        </div>
      </section>

      {/* 3. MARKS MATRIX */}
      <section className="mb-6">
        <div className="overflow-x-auto rounded-xl border border-slate-900">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-blue-950 text-white text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-3 border-r border-blue-900 text-center w-10">#</th>
                <th className="py-3 px-3 border-r border-blue-900 w-24">Code</th>
                <th className="py-3 px-4 border-r border-blue-900">Subject Description</th>
                <th className="py-3 px-3 border-r border-blue-900 text-center w-20">Max Marks</th>
                <th className="py-3 px-3 border-r border-blue-900 text-center w-20">Pass Marks</th>
                <th className="py-3 px-3 border-r border-blue-900 text-center w-24">Obtained</th>
                <th className="py-3 px-3 border-r border-blue-900 text-center w-20">%</th>
                <th className="py-3 px-3 border-r border-blue-900 text-center w-16">Grade</th>
                <th className="py-3 px-3 text-center w-24">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((item, idx) => {
                const pct = item.max > 0 ? Math.round((item.obtained / item.max) * 1000) / 10 : 0;
                return (
                  <tr
                    key={`${item.code}-${idx}`}
                    className={idx % 2 === 1 ? "bg-slate-50/70" : "bg-white"}
                  >
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center font-bold text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 font-mono font-bold text-blue-900">
                      {item.code}
                    </td>
                    <td className="py-2.5 px-4 border-r border-slate-200 font-bold text-slate-900">
                      {item.name}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center text-slate-600 font-medium">
                      {item.max}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center text-slate-500 font-medium">
                      {item.pass}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center font-extrabold text-slate-900 text-sm">
                      {item.obtained}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center font-bold text-slate-700">
                      {pct}%
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center font-black">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-black ${
                          item.grade === "A+"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {item.grade}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-[11px] font-medium text-slate-600">
                      {item.remarks}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-blue-950 text-white font-bold text-xs border-t-2 border-slate-900">
                <td colSpan={3} className="py-3 px-4 text-right uppercase tracking-wider font-extrabold">
                  Grand Total Performance Summary
                </td>
                <td className="py-3 px-3 text-center font-mono font-bold text-amber-300 text-sm">
                  {totalMax}
                </td>
                <td className="py-3 px-3 text-center text-slate-300">—</td>
                <td className="py-3 px-3 text-center font-mono font-black text-amber-300 text-base">
                  {totalObtained}
                </td>
                <td className="py-3 px-3 text-center font-black text-amber-300 text-sm">
                  {overallPct}%
                </td>
                <td className="py-3 px-3 text-center font-black text-amber-300 text-sm">
                  {overallGrade}
                </td>
                <td
                  className={`py-3 px-3 text-center text-[10px] uppercase font-bold ${
                    passed ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {passed ? "PASSED" : "FAILED"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* 4. PERFORMANCE SUMMARY & GRADING KEY */}
      <section className="grid sm:grid-cols-3 gap-5 mb-6">
        <div className="sm:col-span-2 bg-gradient-to-br from-blue-900 to-indigo-950 rounded-xl p-5 text-white shadow-md flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200">
              Final Examination Result
            </span>
            <h3 className="text-xl font-black text-amber-300 mt-1 uppercase">
              {resultHeadline}
            </h3>
            <p className="text-xs text-blue-100 mt-1 font-medium">
              Rank in Class: <span className="font-extrabold text-amber-200">1st Position</span> •
              Attendance: <span className="font-extrabold text-emerald-300">96.5%</span>
            </p>
          </div>
          <div className="text-center bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/20">
            <span className="block text-[9px] uppercase tracking-wider text-blue-200">
              Percentage
            </span>
            <span className="text-2xl font-black text-amber-400">{overallPct}%</span>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 text-[10px]">
          <h4 className="font-extrabold uppercase text-slate-700 tracking-wider mb-2 border-b pb-1 border-slate-200">
            Grading Scale System
          </h4>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-medium text-slate-600">
            <div><span className="font-bold text-emerald-700">A+</span> : 80% - 100%</div>
            <div><span className="font-bold text-blue-700">A</span> : 70% - 79%</div>
            <div><span className="font-bold text-indigo-700">B</span> : 60% - 69%</div>
            <div><span className="font-bold text-amber-700">C</span> : 50% - 59%</div>
            <div><span className="font-bold text-orange-700">D</span> : 40% - 49%</div>
            <div><span className="font-bold text-rose-700">F</span> : Below 40%</div>
          </div>
        </div>
      </section>

      {/* 5. REMARKS */}
      <section className="mb-8 bg-amber-50/60 rounded-xl p-4 border border-amber-200/80">
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
          Class Teacher Remarks & Evaluation:
        </span>
        <p className="text-xs font-semibold text-slate-800 italic leading-relaxed">
          &ldquo;{student?.full_name ?? "The student"} has shown consistent dedication, strong
          conceptual clarity, and admirable discipline throughout the academic session. Recommended
          for continued excellence.&rdquo;
        </p>
      </section>

      {/* 6. SIGNATURES */}
      <footer className="pt-6 border-t-2 border-slate-900">
        <div className="grid grid-cols-3 gap-6 text-center items-end">
          <div>
            <div className="h-10 border-b border-dashed border-slate-400 mb-1 flex items-end justify-center">
              <span className="font-serif italic text-sm text-slate-700 font-bold">M. Ahmed</span>
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 block">
              Class Teacher
            </span>
            <span className="text-[9px] text-slate-400">Signature</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-blue-800 flex items-center justify-center p-1 text-[8px] font-bold text-blue-900 text-center uppercase leading-tight mb-1 bg-blue-50/50">
              Official
              <br />
              Seal
              <br />
              SMPS
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 block">
              Controller Exam
            </span>
            <span className="text-[9px] text-slate-400">Verified Stamp</span>
          </div>

          <div>
            <div className="h-10 border-b border-dashed border-slate-400 mb-1 flex items-end justify-center">
              <span className="font-serif italic text-sm text-blue-900 font-black">
                Tariq M. Khan
              </span>
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 block">
              Principal
            </span>
            <span className="text-[9px] text-slate-400">Authorized Signature</span>
          </div>
        </div>

        <div className="mt-8 pt-3 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-400 font-medium">
          <span>Computer Generated Official Academic Transcript • Shabiran Mustafa Public School</span>
          <span>Verification Code: SMPS-{new Date().getFullYear()}-EXAM-{student?.admission_no ?? "99482"}</span>
        </div>
      </footer>
    </main>
  );
}

"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FileText, Loader2, Printer } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { MarksheetDocument } from "@/components/reports/MarksheetDocument";

interface MarksheetPayload {
  students: { id: number; full_name: string; admission_no: string | null }[];
  sessions: { id: number; name: string }[];
  selectedStudentId: number | null;
  selectedSessionId: number | null;
  student: {
    id: number;
    full_name: string;
    admission_no: string | null;
    dob: string | null;
    b_form_no: string | null;
    families: { guardian_name: string; family_number: number } | null;
  } | null;
  enrollment: {
    roll_no: string | null;
    school_classes: { name: string } | null;
    class_sections: { name: string } | null;
  } | null;
  session: { id: number; name: string } | null;
}

export default function StudentMarksheetPage() {
  const searchParams = useSearchParams();
  const [studentId, setStudentId] = useState(searchParams.get("student") ?? "");
  const [sessionId, setSessionId] = useState(searchParams.get("sessionId") ?? "");
  const [data, setData] = useState<MarksheetPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (studentId) qs.set("studentId", studentId);
      if (sessionId) qs.set("sessionId", sessionId);
      const res = await fetch(`/api/admin/marksheet?${qs.toString()}`);
      if (res.ok) {
        const json = (await res.json()) as MarksheetPayload;
        setData(json);
        if (!studentId && json.selectedStudentId) {
          setStudentId(String(json.selectedStudentId));
        }
        if (!sessionId && json.selectedSessionId) {
          setSessionId(String(json.selectedSessionId));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [studentId, sessionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Examinations & Transcripts"
        title="Student Academic Marksheet"
        description="Preview and print official BISE-aligned examination progress reports."
        icon={<FileText className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="min-w-56 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {(data?.students ?? []).map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.full_name} ({s.admission_no ?? "—"})
                </option>
              ))}
            </select>

            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="min-w-40 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {(data?.sessions ?? []).map((sess) => (
                <option key={sess.id} value={String(sess.id)}>
                  {sess.name}
                </option>
              ))}
            </select>

            {data?.student && (
              <Link
                href={`/print/marksheet/${data.student.id}?session_id=${sessionId}&autoprint=1`}
                target="_blank"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-800 transition"
              >
                <Printer className="h-4 w-4" />
                <span>Print Official Marksheet</span>
              </Link>
            )}
          </div>
        }
      />

      <div className="rounded-3xl border border-slate-200 bg-slate-100/80 p-4 sm:p-8 dark:border-slate-800 dark:bg-slate-900/60">
        <MarksheetDocument
          student={
            data?.student
              ? {
                  full_name: data.student.full_name,
                  admission_no: data.student.admission_no,
                  dob: data.student.dob,
                  b_form_no: data.student.b_form_no,
                  family: data.student.families,
                }
              : null
          }
          enrollment={
            data?.enrollment
              ? {
                  roll_no: data.enrollment.roll_no,
                  schoolClass: data.enrollment.school_classes,
                  section: data.enrollment.class_sections,
                }
              : null
          }
          session={data?.session}
        />
      </div>
    </div>
  );
}

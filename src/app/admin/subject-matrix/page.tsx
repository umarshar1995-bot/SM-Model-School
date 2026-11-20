"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  FileSpreadsheet,
  Loader2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";

interface SessionItem {
  id: number;
  name: string;
  is_current: boolean;
}

interface ClassItem {
  id: number;
  name: string;
}

interface SubjectItem {
  id: number;
  name: string;
  code: string;
}

interface AssignmentItem {
  id: number;
  school_class_id: number;
  subject_id: number;
  total_marks: number;
  pass_marks: number;
  counts_toward_total: boolean;
  is_optional: boolean;
}

interface MatrixPayload {
  sessions: SessionItem[];
  classes: ClassItem[];
  subjects: SubjectItem[];
  selectedSessionId: number | null;
  assignments: AssignmentItem[];
}

export default function SubjectMatrixPage() {
  const [data, setData] = useState<MatrixPayload | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [copySourceClassId, setCopySourceClassId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Settings drawer
  const [drawer, setDrawer] = useState<{
    classId: number;
    className: string;
    subjectId: number;
    subjectName: string;
    totalMarks: number;
    passMarks: number;
    countsTowardTotal: boolean;
    isOptional: boolean;
  } | null>(null);

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const qs = sessionId ? `?sessionId=${sessionId}` : "";
      const res = await fetch(`/api/admin/subject-matrix${qs}`);
      if (res.ok) {
        const json = (await res.json()) as MatrixPayload;
        setData(json);
        if (!sessionId && json.selectedSessionId) {
          setSessionId(String(json.selectedSessionId));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  const assignmentMap = new Map<string, AssignmentItem>();
  for (const a of data?.assignments ?? []) {
    assignmentMap.set(`${a.school_class_id}:${a.subject_id}`, a);
  }

  async function postAction(payload: Record<string, unknown>, key: string, msg?: string) {
    if (!sessionId) return;
    setBusyKey(key);
    try {
      const res = await fetch("/api/admin/subject-matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, sessionId }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Action failed.");
        return false;
      }
      if (msg) toast.success(msg);
      await loadMatrix();
      return true;
    } finally {
      setBusyKey(null);
    }
  }

  function toggleClassCheck(id: number) {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleSubjectCheck(id: number) {
    setSelectedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Curriculum Matrix"
        title="Class-Wise Subject Setup"
        description="Assign curriculum subjects to each class for the selected academic session and configure marks rules."
        icon={<FileSpreadsheet className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {(data?.sessions ?? []).map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name} {s.is_current ? "(Current)" : ""}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={
                selectedClassIds.length === 0 ||
                selectedSubjectIds.length === 0 ||
                busyKey === "bulk"
              }
              onClick={() =>
                postAction(
                  {
                    action: "assign-bulk",
                    classIds: selectedClassIds,
                    subjectIds: selectedSubjectIds,
                  },
                  "bulk",
                  "Selected subjects assigned to chosen classes.",
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-40 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Assign Selected</span>
            </button>

            <button
              type="button"
              disabled={busyKey === "prev"}
              onClick={() =>
                postAction(
                  { action: "copy-previous-session" },
                  "prev",
                  "Copied subject matrix from previous academic session.",
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3.5 py-2 text-xs font-bold text-blue-800 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300 cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Copy Previous Session</span>
            </button>
          </div>
        }
      />

      {/* COPY FROM CLASS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100/80 bg-white px-5 py-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
          <span>
            Selected: <strong>{selectedClassIds.length}</strong> class(es),{" "}
            <strong>{selectedSubjectIds.length}</strong> subject(s)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={copySourceClassId}
            onChange={(e) => setCopySourceClassId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">Copy subjects from class...</option>
            {(data?.classes ?? []).map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!copySourceClassId || selectedClassIds.length === 0}
            onClick={() =>
              postAction(
                {
                  action: "copy-class",
                  sourceClassId: copySourceClassId,
                  targetClassIds: selectedClassIds,
                },
                "copy-class",
                "Copied class subject configuration.",
              )
            }
            className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-40 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300 cursor-pointer"
          >
            Copy to Selected Classes
          </button>
        </div>
      </div>

      {/* MATRIX TABLE */}
      <div className="overflow-x-auto rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
          <thead className="bg-blue-50/70 dark:bg-slate-800/70">
            <tr>
              <th className="w-12 px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Sel
              </th>
              <th className="min-w-40 px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Class
              </th>
              {(data?.subjects ?? []).map((sub) => (
                <th
                  key={sub.id}
                  className="min-w-32 px-3 py-3 text-center text-[11px] font-bold text-slate-700 dark:text-slate-200"
                >
                  <label className="flex cursor-pointer flex-col items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={selectedSubjectIds.includes(sub.id)}
                      onChange={() => toggleSubjectCheck(sub.id)}
                      className="rounded border-blue-300 text-blue-700"
                    />
                    <span>{sub.name}</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {sub.code}
                    </span>
                  </label>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {(data?.classes ?? []).map((cls) => (
              <tr
                key={cls.id}
                className="transition hover:bg-blue-50/40 dark:hover:bg-blue-950/20"
              >
                <td className="px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={selectedClassIds.includes(cls.id)}
                    onChange={() => toggleClassCheck(cls.id)}
                    className="rounded border-blue-300 text-blue-700"
                  />
                </td>
                <th className="px-4 py-3.5 text-left text-xs font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                  {cls.name}
                </th>
                {(data?.subjects ?? []).map((sub) => {
                  const key = `${cls.id}:${sub.id}`;
                  const assignment = assignmentMap.get(key);
                  return (
                    <td key={sub.id} className="px-2.5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          disabled={busyKey === key}
                          onClick={() =>
                            postAction(
                              {
                                action: "toggle",
                                classId: cls.id,
                                subjectId: sub.id,
                              },
                              key,
                            )
                          }
                          className={`inline-flex min-h-8 items-center justify-center rounded-full border px-3 text-[11px] font-bold transition cursor-pointer ${
                            assignment
                              ? "border-blue-700 bg-blue-700 text-white hover:bg-blue-800"
                              : "border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {busyKey === key ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : assignment ? (
                            "Assigned"
                          ) : (
                            "Add"
                          )}
                        </button>
                        {assignment && (
                          <button
                            type="button"
                            onClick={() =>
                              setDrawer({
                                classId: cls.id,
                                className: cls.name,
                                subjectId: sub.id,
                                subjectName: sub.name,
                                totalMarks: assignment.total_marks,
                                passMarks: assignment.pass_marks,
                                countsTowardTotal: assignment.counts_toward_total,
                                isOptional: assignment.is_optional,
                              })
                            }
                            className="rounded-full p-1.5 text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-950 cursor-pointer"
                            title={`Edit marks (${assignment.total_marks}/${assignment.pass_marks})`}
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MARKS SETTINGS SLIDE-OVER DRAWER */}
      {drawer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs"
          onClick={() => setDrawer(null)}
        >
          <aside
            className="h-full w-full max-w-md overflow-y-auto border-l border-blue-100 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600">
                  {drawer.className} • {drawer.subjectName}
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white">
                  Marks Settings
                </h2>
                <p className="text-xs text-slate-500">
                  Configure how this subject contributes to examination results.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawer(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              className="mt-6 space-y-5"
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await postAction(
                  {
                    action: "save-settings",
                    classId: drawer.classId,
                    subjectId: drawer.subjectId,
                    totalMarks: drawer.totalMarks,
                    passMarks: drawer.passMarks,
                    countsTowardTotal: drawer.countsTowardTotal,
                    isOptional: drawer.isOptional,
                  },
                  "save-settings",
                  "Marks settings saved.",
                );
                if (ok) setDrawer(null);
              }}
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Total Marks
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={drawer.totalMarks}
                  onChange={(e) =>
                    setDrawer({ ...drawer, totalMarks: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Pass Marks
                </label>
                <input
                  type="number"
                  min={0}
                  max={drawer.totalMarks}
                  required
                  value={drawer.passMarks}
                  onChange={(e) =>
                    setDrawer({ ...drawer, passMarks: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={drawer.countsTowardTotal}
                  onChange={(e) =>
                    setDrawer({ ...drawer, countsTowardTotal: e.target.checked })
                  }
                  className="rounded border-blue-300 text-blue-700"
                />
                <span>Counts toward grand total & pass/fail calculation</span>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={drawer.isOptional}
                  onChange={(e) =>
                    setDrawer({ ...drawer, isOptional: e.target.checked })
                  }
                  className="rounded border-blue-300 text-blue-700"
                />
                <span>Optional / elective subject</span>
              </label>

              <button
                type="submit"
                disabled={busyKey === "save-settings"}
                className="w-full rounded-xl bg-blue-700 px-4 py-3 text-xs font-black text-white shadow-md hover:bg-blue-800 cursor-pointer"
              >
                Save Marks Settings
              </button>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}

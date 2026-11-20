"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ClipboardCheck,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Badge, statusVariant } from "@/components/ui/Badge";
import { formatDate, formatDateInput } from "@/lib/format";

interface EnrollmentRow {
  id: number;
  student_id: number;
  session_id: number;
  class_id: number;
  section_id: number;
  roll_no: string | null;
  admission_date: string | null;
  status: "active" | "promoted" | "left" | "struck_off" | "passed_out";
  students: { id: number; full_name: string; admission_no: string | null } | null;
  academic_sessions: { id: number; name: string } | null;
  school_classes: { id: number; name: string } | null;
  class_sections: { id: number; name: string } | null;
}

export default function EnrollmentsPage() {
  const searchParams = useSearchParams();
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [students, setStudents] = useState<{ id: number; full_name: string; admission_no: string | null }[]>([]);
  const [sessions, setSessions] = useState<{ id: number; name: string; is_current: boolean }[]>([]);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [sections, setSections] = useState<{ id: number; class_id: number; name: string }[]>([]);

  const [search, setSearch] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [trashed, setTrashed] = useState(false);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EnrollmentRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    student_id: "",
    session_id: "",
    class_id: "",
    section_id: "",
    roll_no: "",
    admission_date: new Date().toISOString().slice(0, 10),
    status: "active" as EnrollmentRow["status"],
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("q", search.trim());
      if (sessionFilter) qs.set("sessionId", sessionFilter);
      if (trashed) qs.set("trashed", "1");

      const res = await fetch(`/api/admin/enrollments?${qs.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setEnrollments(json.enrollments ?? []);
        setStudents(json.students ?? []);
        setSessions(json.sessions ?? []);
        setClasses(json.classes ?? []);
        setSections(json.sections ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [search, sessionFilter, trashed]);

  useEffect(() => {
    const t = window.setTimeout(loadData, 200);
    return () => window.clearTimeout(t);
  }, [loadData]);

  useEffect(() => {
    if (searchParams.get("new") === "1" && sessions.length > 0 && !modalOpen && !editing) {
      openCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, sessions.length]);

  function openCreate() {
    const curSession = sessions.find((s) => s.is_current) ?? sessions[0];
    const firstClass = classes[0];
    const firstSection = sections.find((s) => firstClass && s.class_id === firstClass.id);
    setEditing(null);
    setForm({
      student_id: students[0] ? String(students[0].id) : "",
      session_id: curSession ? String(curSession.id) : "",
      class_id: firstClass ? String(firstClass.id) : "",
      section_id: firstSection ? String(firstSection.id) : "",
      roll_no: "",
      admission_date: new Date().toISOString().slice(0, 10),
      status: "active",
    });
    setModalOpen(true);
  }

  function openEdit(row: EnrollmentRow) {
    setEditing(row);
    setForm({
      student_id: String(row.student_id),
      session_id: String(row.session_id),
      class_id: String(row.class_id),
      section_id: String(row.section_id),
      roll_no: row.roll_no ?? "",
      admission_date: formatDateInput(row.admission_date),
      status: row.status,
    });
    setModalOpen(true);
  }

  const filteredSections = sections.filter(
    (s) => String(s.class_id) === form.class_id,
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/enrollments", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          ...form,
        }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Failed to save enrollment.");
        return;
      }
      toast.success(editing ? "Enrollment updated." : "Student enrolled.");
      setModalOpen(false);
      loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, mode: "soft" | "restore") {
    const res = await fetch(`/api/admin/enrollments?id=${id}&mode=${mode}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(mode === "restore" ? "Enrollment restored." : "Enrollment archived.");
      loadData();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Session Rosters"
        title="Student Enrollments"
        description="Assign students to academic sessions, classes, sections, and roll numbers."
        icon={<ClipboardCheck className="h-5 w-5" />}
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-800 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Enroll Student</span>
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-blue-100/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1 min-w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name, admission #, roll no..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <select
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All Sessions</option>
          {sessions.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setTrashed((t) => !t)}
          className={`rounded-xl px-3 py-2 text-xs font-bold cursor-pointer ${
            trashed
              ? "bg-rose-100 text-rose-700"
              : "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          {trashed ? "Viewing Trash" : "Trash"}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="flex justify-center py-16 text-blue-600">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
                <tr>
                  <th className="px-6 py-3.5">Student</th>
                  <th className="px-6 py-3.5">Session</th>
                  <th className="px-6 py-3.5">Class & Section</th>
                  <th className="px-6 py-3.5">Roll No</th>
                  <th className="px-6 py-3.5">Admission Date</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {enrollments.map((enr) => (
                  <tr
                    key={enr.id}
                    className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-6 py-3.5">
                      <p className="font-extrabold text-slate-900 dark:text-white">
                        {enr.students?.full_name ?? "—"}
                      </p>
                      <p className="font-mono text-[10px] text-blue-600">
                        {enr.students?.admission_no ?? "—"}
                      </p>
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge variant="blue">{enr.academic_sessions?.name ?? "—"}</Badge>
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge variant="emerald">{enr.school_classes?.name ?? "—"}</Badge>{" "}
                      <Badge variant="sky">{enr.class_sections?.name ?? "—"}</Badge>
                    </td>
                    <td className="px-6 py-3.5 font-mono font-bold text-amber-700 dark:text-amber-400">
                      {enr.roll_no ?? "—"}
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">
                      {formatDate(enr.admission_date)}
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge variant={statusVariant(enr.status)} dot>
                        {enr.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
                      {!trashed ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openEdit(enr)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(enr.id, "soft")}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDelete(enr.id, "restore")}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3" /> Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Enrollment" : "Enroll Student into Class & Section"}
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-bold mb-1">Student *</label>
              <select
                required
                value={form.student_id}
                onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">-- Select Student --</option>
                {students.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.full_name} ({s.admission_no ?? "No Adm"})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Academic Session *</label>
              <select
                required
                value={form.session_id}
                onChange={(e) => setForm({ ...form, session_id: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Class *</label>
              <select
                required
                value={form.class_id}
                onChange={(e) => {
                  const cid = e.target.value;
                  const firstSec = sections.find((s) => String(s.class_id) === cid);
                  setForm({
                    ...form,
                    class_id: cid,
                    section_id: firstSec ? String(firstSec.id) : "",
                  });
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              >
                {classes.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Section *</label>
              <select
                required
                value={form.section_id}
                onChange={(e) => setForm({ ...form, section_id: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">-- Select Section --</option>
                {filteredSections.map((sec) => (
                  <option key={sec.id} value={String(sec.id)}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Roll Number</label>
              <input
                type="text"
                value={form.roll_no}
                onChange={(e) => setForm({ ...form, roll_no: e.target.value })}
                placeholder="e.g. 01"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Admission Date</label>
              <input
                type="date"
                value={form.admission_date}
                onChange={(e) => setForm({ ...form, admission_date: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-bold mb-1">Status *</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as EnrollmentRow["status"] })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="active">Active</option>
                <option value="promoted">Promoted</option>
                <option value="left">Left</option>
                <option value="struck_off">Struck Off</option>
                <option value="passed_out">Passed Out</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-700 px-5 py-2 font-bold text-white hover:bg-blue-800 cursor-pointer"
            >
              {saving ? "Saving..." : "Save Enrollment"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

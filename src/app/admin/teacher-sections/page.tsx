"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BookOpen, Loader2, Plus, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";

interface SectionAssign {
  id: number;
  is_class_teacher: boolean;
  academic_sessions: { name: string };
  teachers: { name: string };
  class_sections: { name: string; school_classes: { name: string } };
}

interface SubjectAssign {
  id: number;
  academic_sessions: { name: string };
  teachers: { name: string };
  class_sections: { name: string; school_classes: { name: string } };
  subjects: { name: string; code: string };
}

export default function TeacherSectionsPage() {
  const [sectionAssignments, setSectionAssignments] = useState<SectionAssign[]>([]);
  const [subjectAssignments, setSubjectAssignments] = useState<SubjectAssign[]>([]);
  const [sessions, setSessions] = useState<{ id: number; name: string; is_current: boolean }[]>([]);
  const [teachers, setTeachers] = useState<{ id: number; name: string }[]>([]);
  const [sections, setSections] = useState<{ id: number; name: string; school_classes: { name: string } }[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; name: string; code: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalKind, setModalKind] = useState<"section" | "subject" | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    academic_session_id: "",
    teacher_id: "",
    section_id: "",
    subject_id: "",
    is_class_teacher: false,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/teacher-sections");
      if (res.ok) {
        const json = await res.json();
        setSectionAssignments(json.sectionAssignments ?? []);
        setSubjectAssignments(json.subjectAssignments ?? []);
        setSessions(json.sessions ?? []);
        setTeachers(json.teachers ?? []);
        setSections(json.sections ?? []);
        setSubjects(json.subjects ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openModal(kind: "section" | "subject") {
    const curSess = sessions.find((s) => s.is_current) ?? sessions[0];
    setForm({
      academic_session_id: curSess ? String(curSess.id) : "",
      teacher_id: teachers[0] ? String(teachers[0].id) : "",
      section_id: sections[0] ? String(sections[0].id) : "",
      subject_id: subjects[0] ? String(subjects[0].id) : "",
      is_class_teacher: false,
    });
    setModalKind(kind);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!modalKind) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/teacher-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: modalKind, ...form }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Failed to save assignment.");
        return;
      }
      toast.success("Assignment created.");
      setModalKind(null);
      loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, kind: "section" | "subject") {
    const res = await fetch(`/api/admin/teacher-sections?id=${id}&kind=${kind}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Assignment removed.");
      loadData();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Faculty Allocation"
        title="Teacher Section & Subject Assignments"
        description="Designate class teachers for sections and allocate subject teaching loads per academic session."
        icon={<UserCheck className="h-5 w-5" />}
        actions={
          <>
            <button
              type="button"
              onClick={() => openModal("section")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Assign Section</span>
            </button>
            <button
              type="button"
              onClick={() => openModal("subject")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-4 py-2 text-xs font-bold text-blue-800 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300 cursor-pointer"
            >
              <BookOpen className="h-4 w-4" />
              <span>Assign Subject</span>
            </button>
          </>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16 text-blue-600">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* SECTION ASSIGNMENTS */}
          <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                Section Assignments ({sectionAssignments.length})
              </h2>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
                <tr>
                  <th className="px-5 py-3">Teacher</th>
                  <th className="px-5 py-3">Class & Section</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sectionAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                      No section assignments yet.
                    </td>
                  </tr>
                ) : (
                  sectionAssignments.map((a) => (
                    <tr key={a.id}>
                      <td className="px-5 py-3 font-bold text-slate-900 dark:text-white">
                        {a.teachers.name}
                        <span className="block text-[10px] text-slate-400">
                          {a.academic_sessions.name}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {a.class_sections.school_classes.name} — {a.class_sections.name}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={a.is_class_teacher ? "emerald" : "slate"}>
                          {a.is_class_teacher ? "Class Teacher" : "Assistant"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id, "section")}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          {/* SUBJECT ASSIGNMENTS */}
          <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                Subject Teaching Assignments ({subjectAssignments.length})
              </h2>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
                <tr>
                  <th className="px-5 py-3">Teacher</th>
                  <th className="px-5 py-3">Subject</th>
                  <th className="px-5 py-3">Class & Section</th>
                  <th className="px-5 py-3 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {subjectAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                      No subject teaching assignments yet.
                    </td>
                  </tr>
                ) : (
                  subjectAssignments.map((a) => (
                    <tr key={a.id}>
                      <td className="px-5 py-3 font-bold text-slate-900 dark:text-white">
                        {a.teachers.name}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="indigo">
                          {a.subjects.name} ({a.subjects.code})
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        {a.class_sections.school_classes.name} — {a.class_sections.name}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id, "subject")}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}

      <Modal
        open={modalKind !== null}
        onClose={() => setModalKind(null)}
        title={
          modalKind === "subject"
            ? "Assign Subject to Teacher"
            : "Assign Teacher to Class Section"
        }
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold mb-1">Academic Session *</label>
            <select
              required
              value={form.academic_session_id}
              onChange={(e) =>
                setForm({ ...form, academic_session_id: e.target.value })
              }
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
            <label className="block font-bold mb-1">Teacher *</label>
            <select
              required
              value={form.teacher_id}
              onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            >
              {teachers.length === 0 ? (
                <option value="">No active teachers — create one first</option>
              ) : (
                teachers.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block font-bold mb-1">Class Section *</label>
            <select
              required
              value={form.section_id}
              onChange={(e) => setForm({ ...form, section_id: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            >
              {sections.map((sec) => (
                <option key={sec.id} value={String(sec.id)}>
                  {sec.school_classes.name} — {sec.name}
                </option>
              ))}
            </select>
          </div>

          {modalKind === "subject" ? (
            <div>
              <label className="block font-bold mb-1">Subject *</label>
              <select
                required
                value={form.subject_id}
                onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={String(sub.id)}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_class_teacher}
                onChange={(e) =>
                  setForm({ ...form, is_class_teacher: e.target.checked })
                }
              />
              <span>Designate as Class Teacher</span>
            </label>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalKind(null)}
              className="rounded-xl px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || teachers.length === 0}
              className="rounded-xl bg-blue-700 px-5 py-2 font-bold text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Saving..." : "Save Assignment"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

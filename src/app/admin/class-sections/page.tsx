"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Pencil, Plus, Printer, RotateCcw, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";

interface SectionRow {
  id: number;
  class_id: number;
  name: string;
  capacity: number | null;
  class_teacher_user_id: number | null;
  is_active: boolean;
  school_classes: { id: number; name: string } | null;
  users: { id: number; name: string } | null;
  _count: { student_enrollments: number };
}

export default function ClassSectionsPage() {
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [trashed, setTrashed] = useState(false);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SectionRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    class_id: "",
    name: "",
    capacity: "35",
    class_teacher_user_id: "",
    is_active: true,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/class-sections${trashed ? "?trashed=1" : ""}`);
      if (res.ok) {
        const json = await res.json();
        setSections(json.sections ?? []);
        setClasses(json.classes ?? []);
        setUsers(json.users ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [trashed]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreate() {
    setEditing(null);
    setForm({
      class_id: classes[0] ? String(classes[0].id) : "",
      name: "",
      capacity: "35",
      class_teacher_user_id: "",
      is_active: true,
    });
    setModalOpen(true);
  }

  function openEdit(s: SectionRow) {
    setEditing(s);
    setForm({
      class_id: String(s.class_id),
      name: s.name,
      capacity: s.capacity ? String(s.capacity) : "",
      class_teacher_user_id: s.class_teacher_user_id
        ? String(s.class_teacher_user_id)
        : "",
      is_active: s.is_active,
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/class-sections", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          class_id: form.class_id,
          name: form.name,
          capacity: form.capacity ? Number(form.capacity) : null,
          class_teacher_user_id: form.class_teacher_user_id || null,
          is_active: form.is_active,
        }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Failed to save section.");
        return;
      }
      toast.success(editing ? "Section updated." : "Section created.");
      setModalOpen(false);
      loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, mode: "soft" | "restore") {
    const res = await fetch(`/api/admin/class-sections?id=${id}&mode=${mode}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(mode === "restore" ? "Section restored." : "Section archived.");
      loadData();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic Structure"
        title="Class Sections"
        description="Configure sections within each class, student capacity, and assigned class teachers."
        icon={<UsersRound className="h-5 w-5" />}
        actions={
          <>
            <button
              type="button"
              onClick={() => setTrashed((t) => !t)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold cursor-pointer ${
                trashed
                  ? "bg-rose-100 text-rose-700"
                  : "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {trashed ? "Viewing Trash" : "Trash"}
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Section</span>
            </button>
          </>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="flex justify-center py-16 text-blue-600">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
              <tr>
                <th className="px-6 py-3.5">Class</th>
                <th className="px-6 py-3.5">Section</th>
                <th className="px-6 py-3.5">Occupancy</th>
                <th className="px-6 py-3.5">Class Teacher</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sections.map((sec) => (
                <tr key={sec.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40">
                  <td className="px-6 py-3.5 font-extrabold text-slate-900 dark:text-white">
                    {sec.school_classes?.name ?? "—"}
                  </td>
                  <td className="px-6 py-3.5">
                    <Badge variant="indigo">{sec.name}</Badge>
                  </td>
                  <td className="px-6 py-3.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                    {sec._count.student_enrollments} / {sec.capacity ?? "∞"}
                  </td>
                  <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300">
                    {sec.users?.name ?? "Unassigned"}
                  </td>
                  <td className="px-6 py-3.5">
                    <Badge variant={sec.is_active ? "emerald" : "slate"} dot>
                      {sec.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-6 py-3.5 text-right whitespace-nowrap">
                    {!trashed ? (
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/print/section-cards/${sec.id}`}
                          target="_blank"
                          title="Print All Section ID Cards"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEdit(sec)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(sec.id, "soft")}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDelete(sec.id, "restore")}
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
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Section" : "Create Class Section"}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold mb-1">Class *</label>
              <select
                required
                value={form.class_id}
                onChange={(e) => setForm({ ...form, class_id: e.target.value })}
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
              <label className="block font-bold mb-1">Section Name * (Max 10 chars)</label>
              <input
                type="text"
                required
                maxLength={10}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Section A"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Capacity</label>
              <input
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Class Teacher</label>
              <select
                value={form.class_teacher_user_id}
                onChange={(e) =>
                  setForm({ ...form, class_teacher_user_id: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <span>Active</span>
          </label>

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
              {saving ? "Saving..." : "Save Section"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

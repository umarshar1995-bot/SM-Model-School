"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BookOpen, Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";

interface SubjectRow {
  id: number;
  name: string;
  code: string;
  sort_order: number;
  is_active: boolean;
  _count: { class_subjects: number };
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [trashed, setTrashed] = useState(false);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    sort_order: "0",
    is_active: true,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/subjects${trashed ? "?trashed=1" : ""}`);
      if (res.ok) {
        const json = await res.json();
        setSubjects(json.subjects ?? []);
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
      name: "",
      code: "",
      sort_order: String(subjects.length),
      is_active: true,
    });
    setModalOpen(true);
  }

  function openEdit(s: SubjectRow) {
    setEditing(s);
    setForm({
      name: s.name,
      code: s.code,
      sort_order: String(s.sort_order),
      is_active: s.is_active,
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/subjects", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          name: form.name,
          code: form.code,
          sort_order: Number(form.sort_order),
          is_active: form.is_active,
        }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Failed to save subject.");
        return;
      }
      toast.success(editing ? "Subject updated." : "Subject created.");
      setModalOpen(false);
      loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, mode: "soft" | "restore") {
    const res = await fetch(`/api/admin/subjects?id=${id}&mode=${mode}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(mode === "restore" ? "Subject restored." : "Subject archived.");
      loadData();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Curriculum Catalog"
        title="Subjects"
        description="Manage academic subjects, unique subject codes, and display order."
        icon={<BookOpen className="h-5 w-5" />}
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
              <span>Add Subject</span>
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
                <th className="px-6 py-3.5">Order</th>
                <th className="px-6 py-3.5">Code</th>
                <th className="px-6 py-3.5">Subject Name</th>
                <th className="px-6 py-3.5">Assigned Classes</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {subjects.map((sub) => (
                <tr key={sub.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40">
                  <td className="px-6 py-3.5 font-mono text-slate-500">{sub.sort_order}</td>
                  <td className="px-6 py-3.5 font-mono font-black text-blue-700 dark:text-blue-400">
                    {sub.code}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {sub.name}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <Badge variant="indigo">{sub._count.class_subjects} Matrix Link(s)</Badge>
                  </td>
                  <td className="px-6 py-3.5">
                    <Badge variant={sub.is_active ? "emerald" : "slate"} dot>
                      {sub.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-6 py-3.5 text-right whitespace-nowrap">
                    {!trashed ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(sub)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(sub.id, "soft")}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDelete(sub.id, "restore")}
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
        title={editing ? "Edit Subject" : "Add Curriculum Subject"}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold mb-1">Subject Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Mathematics"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Subject Code *</label>
              <input
                type="text"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="MATH"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono uppercase dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Sort Order</label>
              <input
                type="number"
                required
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
              />
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
              {saving ? "Saving..." : "Save Subject"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

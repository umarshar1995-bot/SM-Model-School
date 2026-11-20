"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Building2, Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";

interface ClassRow {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
  _count: {
    class_sections: number;
    student_enrollments: number;
  };
}

export default function SchoolClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [trashed, setTrashed] = useState(false);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", sort_order: "0", is_active: true });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/school-classes${trashed ? "?trashed=1" : ""}`);
      if (res.ok) {
        const json = await res.json();
        setClasses(json.classes ?? []);
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
    setForm({ name: "", sort_order: String(classes.length), is_active: true });
    setModalOpen(true);
  }

  function openEdit(c: ClassRow) {
    setEditing(c);
    setForm({ name: c.name, sort_order: String(c.sort_order), is_active: c.is_active });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/school-classes", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          name: form.name,
          sort_order: Number(form.sort_order),
          is_active: form.is_active,
        }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Failed to save class.");
        return;
      }
      toast.success(editing ? "Class updated." : "Class created.");
      setModalOpen(false);
      loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, mode: "soft" | "restore") {
    const res = await fetch(`/api/admin/school-classes?id=${id}&mode=${mode}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(mode === "restore" ? "Class restored." : "Class archived.");
      loadData();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic Structure"
        title="School Classes"
        description="Manage class levels (Prep to Class 12) and display ordering."
        icon={<Building2 className="h-5 w-5" />}
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
              <span>Add Class</span>
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
                <th className="px-6 py-3.5">Class Name</th>
                <th className="px-6 py-3.5">Sections</th>
                <th className="px-6 py-3.5">Active Students</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {classes.map((c) => (
                <tr key={c.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40">
                  <td className="px-6 py-3.5 font-mono text-slate-500">{c.sort_order}</td>
                  <td className="px-6 py-3.5 font-extrabold text-slate-900 dark:text-white">
                    {c.name}
                  </td>
                  <td className="px-6 py-3.5">
                    <Badge variant="sky">{c._count.class_sections} Section(s)</Badge>
                  </td>
                  <td className="px-6 py-3.5">
                    <Badge variant="blue">{c._count.student_enrollments} Enrolled</Badge>
                  </td>
                  <td className="px-6 py-3.5">
                    <Badge variant={c.is_active ? "emerald" : "slate"} dot>
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-6 py-3.5 text-right whitespace-nowrap">
                    {!trashed ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id, "soft")}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id, "restore")}
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
        title={editing ? "Edit Class" : "Create School Class"}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold mb-1">Class Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Class 1, Nursery, K.G"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block font-bold mb-1">Display Sort Order *</label>
            <input
              type="number"
              required
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
            />
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
              {saving ? "Saving..." : "Save Class"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

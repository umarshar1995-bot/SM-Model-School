"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CalendarDays, Loader2, Pencil, Plus, RotateCcw, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatDateInput } from "@/lib/format";

interface SessionRow {
  id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  is_active: boolean;
  _count: { student_enrollments: number };
}

export default function AcademicSessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [trashed, setTrashed] = useState(false);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SessionRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    is_current: false,
    is_active: true,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/academic-sessions${trashed ? "?trashed=1" : ""}`);
      if (res.ok) {
        const json = await res.json();
        setSessions(json.sessions ?? []);
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
    setForm({ name: "", start_date: "", end_date: "", is_current: false, is_active: true });
    setModalOpen(true);
  }

  function openEdit(s: SessionRow) {
    setEditing(s);
    setForm({
      name: s.name,
      start_date: formatDateInput(s.start_date),
      end_date: formatDateInput(s.end_date),
      is_current: s.is_current,
      is_active: s.is_active,
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/academic-sessions", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(editing ? { id: editing.id } : {}), ...form }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Failed to save session.");
        return;
      }
      toast.success(editing ? "Session updated." : "Academic session created.");
      setModalOpen(false);
      loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, mode: "soft" | "restore") {
    const res = await fetch(`/api/admin/academic-sessions?id=${id}&mode=${mode}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(mode === "restore" ? "Session restored." : "Session archived.");
      loadData();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic Calendar"
        title="Academic Sessions"
        description="Define school year periods and control which session is active across all consoles."
        icon={<CalendarDays className="h-5 w-5" />}
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
              <span>New Session</span>
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
                <th className="px-6 py-3.5">Session Name</th>
                <th className="px-6 py-3.5">Start Date</th>
                <th className="px-6 py-3.5">End Date</th>
                <th className="px-6 py-3.5">Enrollments</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40">
                  <td className="px-6 py-3.5 font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{s.name}</span>
                    {s.is_current && (
                      <Badge variant="amber">
                        <Star className="h-3 w-3 inline" /> Current
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300">
                    {formatDate(s.start_date)}
                  </td>
                  <td className="px-6 py-3.5 text-slate-600 dark:text-slate-300">
                    {formatDate(s.end_date)}
                  </td>
                  <td className="px-6 py-3.5">
                    <Badge variant="blue">{s._count.student_enrollments} Students</Badge>
                  </td>
                  <td className="px-6 py-3.5">
                    <Badge variant={s.is_active ? "emerald" : "slate"} dot>
                      {s.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-6 py-3.5 text-right whitespace-nowrap">
                    {!trashed ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s.id, "soft")}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id, "restore")}
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
        title={editing ? "Edit Academic Session" : "Create Academic Session"}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold mb-1">Session Name *</label>
            <input
              type="text"
              required
              maxLength={20}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. 2026-2027"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold mb-1">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">End Date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_current}
                onChange={(e) => setForm({ ...form, is_current: e.target.checked })}
              />
              <span>Current Session</span>
            </label>
            <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <span>Active</span>
            </label>
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
              {saving ? "Saving..." : "Save Session"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

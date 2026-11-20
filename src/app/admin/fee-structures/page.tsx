"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Lock, Pencil, Plus, Receipt, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";

interface FeeStructureRow {
  id: number;
  school_class_id: number;
  academic_session_id: number | null;
  tuition_fee: number;
  admission_fee: number;
  exam_fee: number;
  computer_fee: number;
  activity_fee: number;
  late_fine: number;
  school_classes: { id: number; name: string } | null;
  academic_sessions: { id: number; name: string } | null;
}

export default function FeeStructuresPage() {
  const [structures, setStructures] = useState<FeeStructureRow[]>([]);
  const [sessions, setSessions] = useState<{ id: number; name: string; is_current: boolean }[]>([]);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [sessionFilter, setSessionFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    school_class_id: "",
    academic_session_id: "",
    tuition_fee: "3500",
    admission_fee: "0",
    exam_fee: "400",
    computer_fee: "200",
    activity_fee: "100",
    late_fine: "200",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = sessionFilter ? `?sessionId=${sessionFilter}` : "";
      const res = await fetch(`/api/admin/fee-structures${qs}`);
      if (res.ok) {
        const json = await res.json();
        setStructures(json.structures ?? []);
        setSessions(json.sessions ?? []);
        setClasses(json.classes ?? []);
        setCanEdit(Boolean(json.canEdit));
      }
    } finally {
      setLoading(false);
    }
  }, [sessionFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openNew() {
    if (!canEdit) return;
    const currentSess = sessions.find((s) => s.is_current) ?? sessions[0];
    setForm({
      school_class_id: classes[0] ? String(classes[0].id) : "",
      academic_session_id: currentSess ? String(currentSess.id) : "",
      tuition_fee: "3800",
      admission_fee: "0",
      exam_fee: "400",
      computer_fee: "200",
      activity_fee: "100",
      late_fine: "200",
    });
    setModalOpen(true);
  }

  function openEdit(row: FeeStructureRow) {
    if (!canEdit) return;
    setForm({
      school_class_id: String(row.school_class_id),
      academic_session_id: row.academic_session_id ? String(row.academic_session_id) : "",
      tuition_fee: String(row.tuition_fee),
      admission_fee: String(row.admission_fee),
      exam_fee: String(row.exam_fee),
      computer_fee: String(row.computer_fee),
      activity_fee: String(row.activity_fee),
      late_fine: String(row.late_fine),
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/fee-structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_class_id: form.school_class_id,
          academic_session_id: form.academic_session_id || null,
          tuition_fee: Number(form.tuition_fee),
          admission_fee: Number(form.admission_fee),
          exam_fee: Number(form.exam_fee),
          computer_fee: Number(form.computer_fee),
          activity_fee: Number(form.activity_fee),
          late_fine: Number(form.late_fine),
        }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Failed to save fee structure.");
        return;
      }
      toast.success("Class fee structure saved.");
      setModalOpen(false);
      loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!canEdit) return;
    if (!confirm("Delete this legacy class fee structure?")) return;
    const res = await fetch(`/api/admin/fee-structures?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Fee structure removed.");
      loadData();
    } else {
      const out = await res.json().catch(() => ({}));
      toast.error(out.error || "Failed to delete fee structure.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Legacy Fee Configuration"
        title="Class Fee Structures"
        description="View legacy class fee schedules. Use the Administrator Fee Settings Matrix to configure Monthly, Exam, Promotion, and Books fees with full audit tracking."
        icon={<Receipt className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">All Sessions</option>
              {sessions.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
            {canEdit && (
              <>
                <Link
                  href="/admin/fee-settings"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Open Fee Settings Matrix</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={openNew}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Set Legacy Fee</span>
                </button>
              </>
            )}
          </div>
        }
      />

      {!loading && !canEdit && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <Lock className="h-5 w-5 shrink-0 text-amber-600" />
          <span>
            Read-only view: Only the <strong>Administrator</strong> can create, edit, or delete fee amounts.
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="flex justify-center py-16 text-blue-600">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
                <tr>
                  <th className="px-6 py-4">Class</th>
                  <th className="px-6 py-4">Session</th>
                  <th className="px-6 py-4 text-right">Tuition</th>
                  <th className="px-6 py-4 text-right">Exam</th>
                  <th className="px-6 py-4 text-right">Computer</th>
                  <th className="px-6 py-4 text-right">Activity</th>
                  <th className="px-6 py-4 text-right">Late Fine</th>
                  <th className="px-6 py-4 text-right">Total Monthly</th>
                  {canEdit && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {structures.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 9 : 8} className="px-6 py-12 text-center text-slate-400">
                      No legacy class fee structures defined yet. Configure per-class Monthly, Exam, Promotion, and Books fees in Fee Settings.
                    </td>
                  </tr>
                ) : (
                  structures.map((row) => {
                    const gross =
                      Number(row.tuition_fee) +
                      Number(row.exam_fee) +
                      Number(row.computer_fee) +
                      Number(row.activity_fee);
                    return (
                      <tr key={row.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                          {row.school_classes?.name ?? "—"}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="blue">
                            {row.academic_sessions?.name ?? "All"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right font-mono">
                          {formatCurrency(row.tuition_fee)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono">
                          {formatCurrency(row.exam_fee)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono">
                          {formatCurrency(row.computer_fee)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono">
                          {formatCurrency(row.activity_fee)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-rose-600">
                          {formatCurrency(row.late_fine)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-black text-blue-900 dark:text-blue-300">
                          {formatCurrency(gross)}
                        </td>
                        {canEdit && (
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                              aria-label="Edit fee structure"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row.id)}
                              className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                              aria-label="Delete fee structure"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen && canEdit}
        onClose={() => setModalOpen(false)}
        title="Configure Legacy Class Fee Structure"
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold mb-1">Class *</label>
              <select
                required
                value={form.school_class_id}
                onChange={(e) => setForm({ ...form, school_class_id: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800"
              >
                {classes.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Academic Session</label>
              <select
                value={form.academic_session_id}
                onChange={(e) =>
                  setForm({ ...form, academic_session_id: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            {[
              { key: "tuition_fee", label: "Monthly Tuition (Rs.)" },
              { key: "exam_fee", label: "Exam Fee (Rs.)" },
              { key: "computer_fee", label: "Computer Fee (Rs.)" },
              { key: "activity_fee", label: "Activity Fee (Rs.)" },
              { key: "admission_fee", label: "Admission Fee (Rs.)" },
              { key: "late_fine", label: "Late Fine (Rs.)" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block font-bold mb-1">{label}</label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  required
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl px-4 py-2.5 font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-700 px-5 py-2.5 font-bold text-white hover:bg-blue-800 cursor-pointer"
            >
              {saving ? "Saving..." : "Save Structure"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

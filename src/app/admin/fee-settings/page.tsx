"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  History,
  Loader2,
  Lock,
  Pencil,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/format";

interface SessionItem {
  id: number;
  name: string;
  is_current: boolean;
}

interface ClassItem {
  id: number;
  name: string;
  sort_order: number;
}

interface FeeTypeItem {
  id: number;
  code: string;
  name: string;
  frequency: string;
  sort_order: number;
}

interface ClassFeeAmountRow {
  id: number;
  school_class_id: number;
  academic_session_id: number;
  fee_type_id: number;
  amount: number;
  updated_at: string | null;
  users: { id: number; name: string } | null;
}

interface AuditLogRow {
  id: number;
  user_name: string;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  reason: string | null;
  ip_address: string | null;
  created_at: string;
}

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: "Every Month • Sibling Disc.",
  per_term: "Per Exam Term",
  on_promotion: "Once on Promotion",
  once_per_session: "Once per Session",
};

const FEE_CODE_COLORS: Record<string, string> = {
  MONTHLY: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-800",
  EXAM: "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-800",
  PROMOTION: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800",
  BOOKS: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800",
};

export default function FeeSettingsPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeTypeItem[]>([]);
  const [amounts, setAmounts] = useState<ClassFeeAmountRow[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  // Edit Cell Modal State (with 2-step confirmation)
  const [editTarget, setEditTarget] = useState<{
    schoolClass: ClassItem;
    feeType: FeeTypeItem;
    currentRow: ClassFeeAmountRow | null;
  } | null>(null);
  const [newAmountInput, setNewAmountInput] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [confirmStep, setConfirmStep] = useState(false);
  const [saving, setSaving] = useState(false);

  // Cell History Drawer/Modal State
  const [historyTarget, setHistoryTarget] = useState<{
    title: string;
    entityId: number;
  } | null>(null);
  const [historyLogs, setHistoryLogs] = useState<AuditLogRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadMatrix = useCallback(async () => {
    setLoading(true);
    setAccessError(null);
    try {
      const qs = selectedSessionId ? `?sessionId=${selectedSessionId}` : "";
      const res = await fetch(`/api/admin/fee-amounts${qs}`);
      const json = await res.json();
      if (!res.ok) {
        setAccessError(json.error || "Unable to load fee settings.");
        return;
      }
      setSessions(json.sessions ?? []);
      setClasses(json.classes ?? []);
      setFeeTypes(json.feeTypes ?? []);
      setAmounts(json.amounts ?? []);
      setCanEdit(Boolean(json.canEdit));
      if (!selectedSessionId && json.selectedSession?.id) {
        setSelectedSessionId(String(json.selectedSession.id));
      }
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId]);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  const amountMap = useMemo(() => {
    const map = new Map<string, ClassFeeAmountRow>();
    for (const row of amounts) {
      map.set(`${row.school_class_id}:${row.fee_type_id}`, row);
    }
    return map;
  }, [amounts]);

  function openEditCell(schoolClass: ClassItem, feeType: FeeTypeItem) {
    if (!canEdit) return;
    const currentRow = amountMap.get(`${schoolClass.id}:${feeType.id}`) ?? null;
    setEditTarget({ schoolClass, feeType, currentRow });
    setNewAmountInput(currentRow ? String(Number(currentRow.amount)) : "0");
    setChangeReason("");
    setConfirmStep(false);
  }

  function handlePrepareConfirm(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(newAmountInput);
    if (!Number.isFinite(num) || num < 0 || num > 1_000_000) {
      toast.error("Please enter a valid fee amount between Rs. 0 and Rs. 1,000,000.");
      return;
    }
    const oldVal = editTarget?.currentRow ? Number(editTarget.currentRow.amount) : 0;
    if (Math.round(num * 100) === Math.round(oldVal * 100) && editTarget?.currentRow) {
      toast.info("The new amount is identical to the current amount.");
      return;
    }
    setConfirmStep(true);
  }

  async function handleCommitChange() {
    if (!editTarget || !selectedSessionId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/fee-amounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_class_id: editTarget.schoolClass.id,
          academic_session_id: selectedSessionId,
          fee_type_id: editTarget.feeType.id,
          amount: Number(newAmountInput),
          reason: changeReason.trim() || null,
        }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Failed to update fee amount.");
        return;
      }
      toast.success(
        `Updated ${editTarget.schoolClass.name} — ${editTarget.feeType.name} to ${formatCurrency(Number(newAmountInput))}.`,
      );
      setEditTarget(null);
      setConfirmStep(false);
      loadMatrix();
    } finally {
      setSaving(false);
    }
  }

  async function openHistory(schoolClass: ClassItem, feeType: FeeTypeItem, row: ClassFeeAmountRow) {
    if (!canEdit) return;
    setHistoryTarget({
      title: `${schoolClass.name} — ${feeType.name}`,
      entityId: row.id,
    });
    setHistoryLogs([]);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/admin/fee-amounts?historyEntityId=${row.id}`);
      const json = await res.json();
      if (res.ok) {
        setHistoryLogs(json.logs ?? []);
      } else {
        toast.error(json.error || "Unable to load cell audit history.");
      }
    } finally {
      setLoadingHistory(false);
    }
  }

  const currentSessionName =
    sessions.find((s) => String(s.id) === selectedSessionId)?.name ?? "Current Session";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administrator Fee Control"
        title="Fee Settings Matrix"
        description="Configure Monthly Tuition, Examination, Promotion, and Books & Stationery fees per class. Every change requires confirmation and is permanently recorded in the immutable audit log."
        icon={<SlidersHorizontal className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {canEdit ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-extrabold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                Administrator Edit Access
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-extrabold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                <Lock className="h-4 w-4" />
                Read-Only (Admin Only)
              </span>
            )}
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-xs focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {sessions.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name} {s.is_current ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {!loading && !canEdit && !accessError && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <Lock className="h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-extrabold">Administrator-Only Fee Configuration</p>
            <p className="text-xs font-medium text-amber-800/90 dark:text-amber-300/90">
              You are viewing the configured fee schedule in read-only mode. Only the Administrator can modify Monthly, Exam, Promotion, or Books fees.
            </p>
          </div>
        </div>
      )}

      {accessError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {accessError}
        </div>
      )}

      {/* Fee Type Summary Strip */}
      {!accessError && feeTypes.length > 0 && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {feeTypes.map((ft) => {
            const rowsForType = amounts.filter((a) => a.fee_type_id === ft.id);
            const avg =
              rowsForType.length > 0
                ? Math.round(
                    rowsForType.reduce((sum, r) => sum + Number(r.amount), 0) /
                      rowsForType.length,
                  )
                : 0;
            return (
              <div
                key={ft.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-lg border px-2.5 py-0.5 text-xs font-black tracking-wide ${
                      FEE_CODE_COLORS[ft.code] ??
                      "bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    {ft.code}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    {rowsForType.length}/{classes.length} classes
                  </span>
                </div>
                <p className="mt-2.5 text-base font-extrabold text-slate-900 dark:text-white">
                  {ft.name}
                </p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {FREQUENCY_LABELS[ft.frequency] ?? ft.frequency}
                </p>
                <p className="mt-2 font-mono text-sm font-bold text-blue-700 dark:text-blue-400">
                  Avg: {formatCurrency(avg)}
                </p>
              </div>
            );
          })}
        </section>
      )}

      {/* Main Matrix Table */}
      {!accessError && (
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Class × Fee Type Schedule ({currentSessionName})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {canEdit
                  ? "Click any fee amount to edit with confirmation, or click the clock icon to inspect its audit trail."
                  : "Fee amounts are locked to Administrator accounts."}
              </p>
            </div>
            {loading && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
          </div>

          {loading ? (
            <div className="flex justify-center py-20 text-blue-600">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                  <tr>
                    <th className="px-6 py-4">Class</th>
                    {feeTypes.map((ft) => (
                      <th key={ft.id} className="px-5 py-4 text-right">
                        <span className="block">{ft.name}</span>
                        <span className="mt-0.5 block text-[11px] font-semibold normal-case text-slate-400">
                          {FREQUENCY_LABELS[ft.frequency] ?? ft.frequency}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {classes.map((cls) => (
                    <tr
                      key={cls.id}
                      className="transition hover:bg-blue-50/35 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-base font-extrabold text-slate-900 dark:text-white">
                          {cls.name}
                        </p>
                      </td>

                      {feeTypes.map((ft) => {
                        const row = amountMap.get(`${cls.id}:${ft.id}`) ?? null;
                        const amountVal = row ? Number(row.amount) : 0;
                        return (
                          <td key={ft.id} className="px-5 py-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {canEdit ? (
                                <button
                                  type="button"
                                  onClick={() => openEditCell(cls, ft)}
                                  className="group inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 font-mono text-sm font-extrabold text-slate-900 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-900 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white dark:hover:border-blue-500 dark:hover:bg-blue-950/60 cursor-pointer"
                                  title={`Edit ${cls.name} ${ft.name}`}
                                >
                                  <span>{formatCurrency(amountVal)}</span>
                                  <Pencil className="h-3.5 w-3.5 text-slate-400 transition group-hover:text-blue-600" />
                                </button>
                              ) : (
                                <span className="inline-flex items-center rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2 font-mono text-sm font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
                                  {formatCurrency(amountVal)}
                                </span>
                              )}

                              {canEdit && row && (
                                <button
                                  type="button"
                                  onClick={() => openHistory(cls, ft, row)}
                                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-400 cursor-pointer"
                                  title="View change audit history"
                                  aria-label={`Audit history for ${cls.name} ${ft.name}`}
                                >
                                  <History className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                            {row?.users?.name && (
                              <p className="mt-1 text-[11px] text-slate-400">
                                Updated by {row.users.name}
                              </p>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Edit Fee Amount Modal (Two-Step Confirm Old -> New) */}
      <Modal
        open={Boolean(editTarget)}
        onClose={() => {
          setEditTarget(null);
          setConfirmStep(false);
        }}
        title={
          editTarget
            ? `Edit ${editTarget.schoolClass.name} — ${editTarget.feeType.name}`
            : "Edit Fee Amount"
        }
        subtitle={`Academic Session: ${currentSessionName} • Logged to immutable fee audit trail`}
        maxWidthClass="max-w-md"
      >
        {editTarget && !confirmStep && (
          <form onSubmit={handlePrepareConfirm} className="space-y-4 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
              <span className="font-semibold text-slate-500 dark:text-slate-400">
                Current Amount
              </span>
              <span className="font-mono text-base font-black text-slate-900 dark:text-white">
                {formatCurrency(editTarget.currentRow?.amount ?? 0)}
              </span>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                New Amount (Rs.) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min={0}
                max={1000000}
                step="1"
                required
                autoFocus
                value={newAmountInput}
                onChange={(e) => setNewAmountInput(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-lg font-black text-blue-950 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                Reason / Approval Note (Optional)
              </label>
              <input
                type="text"
                maxLength={300}
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="e.g. Annual session fee revision approved by Principal"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-800 cursor-pointer"
              >
                <span>Review Change</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}

        {editTarget && confirmStep && (
          <div className="space-y-5 text-sm">
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p className="font-extrabold">Confirm Fee Amount Change</p>
              </div>
              <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
                This will immediately update the rate for future challan generations and write a permanent audit entry.
              </p>

              <div className="mt-4 flex items-center justify-center gap-4 rounded-xl bg-white p-4 shadow-xs dark:bg-slate-900">
                <div className="text-center">
                  <span className="block text-[11px] font-bold uppercase text-slate-400">
                    Old Amount
                  </span>
                  <span className="font-mono text-lg font-extrabold text-slate-500 line-through">
                    {formatCurrency(editTarget.currentRow?.amount ?? 0)}
                  </span>
                </div>
                <ArrowRight className="h-5 w-5 text-blue-600" />
                <div className="text-center">
                  <span className="block text-[11px] font-bold uppercase text-emerald-600">
                    New Amount
                  </span>
                  <span className="font-mono text-xl font-black text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(Number(newAmountInput))}
                  </span>
                </div>
              </div>

              {changeReason.trim() && (
                <p className="mt-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Reason: &ldquo;{changeReason.trim()}&rdquo;
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                disabled={saving}
                onClick={() => setConfirmStep(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleCommitChange}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-md hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>Confirm & Save Rate</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cell Audit History Modal */}
      <Modal
        open={Boolean(historyTarget)}
        onClose={() => setHistoryTarget(null)}
        title={historyTarget ? `Audit History: ${historyTarget.title}` : "Audit History"}
        subtitle="Append-only change log from fee_audit_logs"
        maxWidthClass="max-w-xl"
      >
        {loadingHistory ? (
          <div className="flex justify-center py-10 text-blue-600">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : historyLogs.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            No edits recorded for this fee cell yet. Initial value was seeded during setup.
          </p>
        ) : (
          <ul className="max-h-96 space-y-3 overflow-y-auto pr-1 text-sm">
            {historyLogs.map((log) => (
              <li
                key={log.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="blue">{log.action}</Badge>
                    <strong className="font-bold text-slate-900 dark:text-white">
                      {log.user_name}
                    </strong>
                  </div>
                  <span className="font-mono text-xs text-slate-500">
                    {formatDate(log.created_at)}{" "}
                    {new Date(log.created_at).toLocaleTimeString("en-PK", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center gap-2 font-mono text-sm">
                  <span className="rounded-lg bg-slate-200/80 px-2.5 py-1 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {formatCurrency(Number(log.old_values?.amount ?? 0))}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                  <span className="rounded-lg bg-emerald-100 px-2.5 py-1 font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {formatCurrency(Number(log.new_values?.amount ?? 0))}
                  </span>
                </div>
                {log.reason && (
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                    <strong>Note:</strong> {log.reason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

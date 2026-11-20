"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Badge, statusVariant } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, formatDate } from "@/lib/format";

interface SessionItem {
  id: number;
  name: string;
  is_current: boolean;
}

interface PaymentRow {
  id: number;
  receipt_no: string;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
  transaction_reference: string | null;
  remarks: string | null;
  status: string;
  reversed_at: string | null;
  reversal_reason: string | null;
  created_at: string | null;
  users: { id: number; name: string } | null;
  users_fee_payments_reversed_by_user_idTousers: { id: number; name: string } | null;
}

interface ChallanRow {
  id: number;
  challan_no: string;
  billing_month: string;
  issue_date: string;
  due_date: string;
  total_gross: number;
  total_concession: number;
  total_arrears: number;
  late_fine: number;
  late_fine_applied_at: string | null;
  payable_before_due: number;
  payable_after_due: number;
  paid_amount: number;
  status: string;
  families: {
    id: number;
    family_number: number;
    guardian_name: string;
    guardian_mobile: string | null;
  } | null;
  fee_payments: PaymentRow[];
  student_fees: {
    id: number;
    fee_type: string;
    amount: number;
    fee_types: { id: number; code: string; name: string } | null;
    students: {
      full_name: string;
      student_enrollments: {
        school_classes: { name: string } | null;
      }[];
    } | null;
  }[];
}

interface FeesPayload {
  sessions: SessionItem[];
  selectedSessionId: number | null;
  selectedMonth: string;
  availableMonths: string[];
  challans: ChallanRow[];
  permissions: {
    canEditFees: boolean;
    canReverse: boolean;
    canCollect: boolean;
    canGenerate: boolean;
  };
  summary: {
    totalBilled: number;
    totalCollected: number;
    totalArrears: number;
    totalOutstanding: number;
    recoveryRate: number;
  };
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pay-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

const FEE_BADGE_STYLES: Record<string, string> = {
  MONTHLY: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  EXAM: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300",
  PROMOTION: "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  BOOKS: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
};

export default function FeeManagementConsolePage() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<FeesPayload | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(searchParams.get("q") ?? "");
  const [loading, setLoading] = useState(true);
  const [applyingLateFines, setApplyingLateFines] = useState(false);

  // Billing Run Modal State
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [includeMonthly, setIncludeMonthly] = useState(true);
  const [includeExam, setIncludeExam] = useState(false);
  const [examTerm, setExamTerm] = useState("Mid-Term");
  const [includeBooks, setIncludeBooks] = useState(false);
  const [includePromotion, setIncludePromotion] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Fool-Proof Payment Collection Modal State
  const [activeChallan, setActiveChallan] = useState<ChallanRow | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [collectAmount, setCollectAmount] = useState("");
  const [collectMethod, setCollectMethod] = useState("Cash");
  const [collectReference, setCollectReference] = useState("");
  const [collectNotes, setCollectNotes] = useState("");
  const [confirmPaymentStep, setConfirmPaymentStep] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState<{
    id: number;
    receipt_no: string;
    amount_paid: number;
  } | null>(null);

  // Payment History & Reversal Modal State
  const [historyChallanId, setHistoryChallanId] = useState<number | null>(null);
  const [reversingPaymentId, setReversingPaymentId] = useState<number | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [submittingReversal, setSubmittingReversal] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(searchQuery), 260);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  const loadFees = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (sessionId) qs.set("sessionId", sessionId);
      if (selectedMonth.trim()) qs.set("month", selectedMonth.trim());
      if (debouncedQuery.trim()) qs.set("q", debouncedQuery.trim());

      const res = await fetch(`/api/admin/fees?${qs.toString()}`);
      if (res.ok) {
        const json = (await res.json()) as FeesPayload;
        setData(json);
        if (!sessionId && json.selectedSessionId) {
          setSessionId(String(json.selectedSessionId));
        }
        if (!selectedMonth && json.selectedMonth) {
          setSelectedMonth(json.selectedMonth);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, selectedMonth, debouncedQuery]);

  useEffect(() => {
    loadFees();
  }, [loadFees]);

  const perms = data?.permissions ?? {
    canEditFees: false,
    canReverse: false,
    canCollect: false,
    canGenerate: false,
  };

  async function handleGenerateRoll(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMonth.trim()) {
      toast.error("Enter a billing month first (e.g. November 2026).");
      return;
    }
    if (!includeMonthly && !includeExam && !includeBooks && !includePromotion) {
      toast.error("Select at least one fee type to include in this billing run.");
      return;
    }
    if (includeExam && !examTerm.trim()) {
      toast.error("Enter an Exam Term label (e.g. Mid-Term or Final).");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-roll",
          billingMonth: selectedMonth.trim(),
          sessionId: sessionId || null,
          includeMonthly,
          includeExam,
          examTerm: includeExam ? examTerm.trim() : null,
          includeBooks,
          includePromotion,
        }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Failed to generate challans.");
        return;
      }
      toast.success(out.message || "Challans generated successfully.");
      setBillingModalOpen(false);
      loadFees();
    } finally {
      setGenerating(false);
    }
  }

  async function handleApplyLateFines() {
    if (!confirm("Apply overdue late fines to all unpaid/partial challans past their due date?")) {
      return;
    }
    setApplyingLateFines(true);
    try {
      const res = await fetch("/api/admin/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply-late-fines" }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Failed to apply overdue late fines.");
        return;
      }
      toast.success(out.message);
      loadFees();
    } finally {
      setApplyingLateFines(false);
    }
  }

  function openCollectModal(challan: ChallanRow) {
    const remaining = Math.max(
      0,
      Number(challan.payable_before_due) - Number(challan.paid_amount),
    );
    setActiveChallan(challan);
    setIdempotencyKey(generateIdempotencyKey());
    setCollectAmount(String(Math.round(remaining)));
    setCollectMethod("Cash");
    setCollectReference("");
    setCollectNotes("");
    setConfirmPaymentStep(false);
    setCompletedReceipt(null);
  }

  const activeRemainingDue = activeChallan
    ? Math.max(
        0,
        Number(activeChallan.payable_before_due) - Number(activeChallan.paid_amount),
      )
    : 0;
  const parsedCollectAmount = Number(collectAmount);
  const isValidAmount =
    Number.isFinite(parsedCollectAmount) &&
    parsedCollectAmount > 0 &&
    parsedCollectAmount <= activeRemainingDue;
  const balanceAfterPayment = Math.max(
    0,
    activeRemainingDue - (Number.isFinite(parsedCollectAmount) ? parsedCollectAmount : 0),
  );
  const referenceRequired = collectMethod !== "Cash";

  function handleReviewPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!activeChallan) return;
    if (!Number.isFinite(parsedCollectAmount) || parsedCollectAmount <= 0) {
      toast.error("Payment amount must be greater than Rs. 0.");
      return;
    }
    if (parsedCollectAmount > activeRemainingDue) {
      toast.error(
        `Overpayment blocked: maximum payable is ${formatCurrency(activeRemainingDue)}.`,
      );
      return;
    }
    if (referenceRequired && !collectReference.trim()) {
      toast.error(
        `Transaction / Deposit Slip reference is required for ${collectMethod}.`,
      );
      return;
    }
    setConfirmPaymentStep(true);
  }

  async function handleConfirmPayment() {
    if (!activeChallan || submittingPayment) return;
    setSubmittingPayment(true);
    try {
      const res = await fetch("/api/admin/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "collect-payment",
          challanId: activeChallan.id,
          amountPaid: parsedCollectAmount,
          paymentMethod: collectMethod,
          reference: collectReference.trim() || null,
          remarks: collectNotes.trim() || null,
          idempotencyKey,
        }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Payment collection failed.");
        setConfirmPaymentStep(false);
        return;
      }
      toast.success(out.message || "Payment recorded successfully.");
      setCompletedReceipt({
        id: out.payment.id,
        receipt_no: out.payment.receipt_no,
        amount_paid: Number(out.payment.amount_paid),
      });
      loadFees();
    } finally {
      setSubmittingPayment(false);
    }
  }

  async function handleReversePayment(paymentId: number) {
    if (reversalReason.trim().length < 10) {
      toast.error("Please enter a reversal reason of at least 10 characters.");
      return;
    }
    setSubmittingReversal(true);
    try {
      const res = await fetch("/api/admin/fees/reverse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId,
          reason: reversalReason.trim(),
        }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Failed to reverse payment.");
        return;
      }
      toast.success(out.message || "Payment reversed.");
      setReversingPaymentId(null);
      setReversalReason("");
      loadFees();
    } finally {
      setSubmittingReversal(false);
    }
  }

  const historyChallan =
    historyChallanId != null
      ? (data?.challans.find((c) => c.id === historyChallanId) ?? null)
      : null;

  return (
    <div className="space-y-6">
      {/* 1. HERO HEADER */}
      <section className="relative overflow-hidden rounded-3xl border border-blue-200/60 bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-950 p-6 text-white shadow-xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/30">
                <Banknote className="h-4 w-4" />
              </span>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-300">
                Fool-Proof Finance Engine
              </p>
            </div>
            <h1 className="mt-1.5 text-2xl font-black tracking-tight sm:text-3xl">
              Fees & Family Challans Console
            </h1>
            <p className="mt-1 text-sm text-blue-200/85">
              Monthly Tuition (0% / 20% / 50% sibling discount), Exam, Promotion &amp; Books billing with sequence receipts and full audit trail.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {perms.canEditFees && (
              <>
                <Link
                  href="/admin/fee-settings"
                  className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>Fee Settings</span>
                </Link>
                <button
                  type="button"
                  disabled={applyingLateFines}
                  onClick={handleApplyLateFines}
                  className="inline-flex items-center gap-2 rounded-2xl bg-rose-500/25 px-4 py-3 text-sm font-bold text-rose-100 ring-1 ring-rose-400/40 transition hover:bg-rose-500/35 disabled:opacity-60 cursor-pointer"
                >
                  {applyingLateFines ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                  <span>Apply Late Fines</span>
                </button>
              </>
            )}
            {perms.canGenerate && (
              <button
                type="button"
                onClick={() => setBillingModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg transition hover:bg-amber-300 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Generate {selectedMonth || "Monthly"} Challans</span>
              </button>
            )}
          </div>
        </div>

        {/* FILTER STRIP */}
        <div className="relative mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md sm:grid-cols-3">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-blue-200">
              Academic Session
            </label>
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border-0 bg-white/95 px-3.5 py-2.5 text-sm font-bold text-slate-900 shadow-sm focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-white"
            >
              {(data?.sessions ?? []).map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name} {s.is_current ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-blue-200">
              Billing Month
            </label>
            <input
              type="text"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              placeholder="e.g. November 2026"
              list="billing-months-list"
              className="mt-1.5 w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-sm font-extrabold text-blue-950 shadow-sm focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-white"
            />
            <datalist id="billing-months-list">
              {(data?.availableMonths ?? []).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-blue-200">
              Search Family, Student, or Challan #
            </label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name, FAM-ID, challan..."
                className="w-full rounded-xl border-0 bg-white/95 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. FINANCIAL KPI CARDS */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="block text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Total Billed ({selectedMonth || "Month"})
          </span>
          <span className="mt-1.5 block text-2xl font-black text-slate-900 dark:text-white">
            {formatCurrency(data?.summary.totalBilled)}
          </span>
          <span className="text-xs font-semibold text-slate-400">
            {data?.challans.length ?? 0} Families Billed
          </span>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="block text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Total Collected
          </span>
          <span className="mt-1.5 block text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {formatCurrency(data?.summary.totalCollected)}
          </span>
          <span className="text-xs font-bold text-emerald-600">
            {data?.summary.recoveryRate ?? 0}% Recovery Rate
          </span>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="block text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Rolled In Arrears
          </span>
          <span
            className={`mt-1.5 block text-2xl font-black ${
              (data?.summary.totalArrears ?? 0) > 0
                ? "text-amber-600"
                : "text-slate-900 dark:text-white"
            }`}
          >
            {formatCurrency(data?.summary.totalArrears)}
          </span>
          <span className="text-xs font-semibold text-slate-400">
            Carried from prior months
          </span>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="block text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Net Outstanding Balance
          </span>
          <span
            className={`mt-1.5 block text-2xl font-black ${
              (data?.summary.totalOutstanding ?? 0) > 0
                ? "text-rose-600"
                : "text-emerald-600"
            }`}
          >
            {formatCurrency(data?.summary.totalOutstanding)}
          </span>
          <span className="text-xs font-bold text-rose-500">Due from parents</span>
        </div>
      </section>

      {/* 3. MASTER FAMILY CHALLANS LEDGER */}
      <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-blue-600" />
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              Family Fee Slips &amp; Ledger ({selectedMonth})
            </h2>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
          </div>
          <p className="text-xs text-slate-500">
            Overpayments &amp; duplicate submissions are strictly blocked by server-side transaction locks.
          </p>
        </div>

        {(data?.challans ?? []).length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-slate-800">
              <Banknote className="h-8 w-8" />
            </div>
            <h3 className="mt-3 text-base font-bold text-slate-800 dark:text-slate-200">
              No Challans for {selectedMonth}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {perms.canGenerate
                ? `Click "Generate ${selectedMonth} Challans" above to run billing for active families.`
                : "No challans have been generated for this billing month yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
                <tr>
                  <th className="px-5 py-3.5">Challan #</th>
                  <th className="px-5 py-3.5">Family &amp; Fee Heads</th>
                  <th className="px-4 py-3.5 text-right">Gross</th>
                  <th className="px-4 py-3.5 text-right">Disc.</th>
                  <th className="px-4 py-3.5 text-right">Arrears</th>
                  <th className="px-4 py-3.5 text-right">Net Due</th>
                  <th className="px-4 py-3.5 text-right">Paid</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(data?.challans ?? []).map((c) => {
                  const remainingDue = Math.max(
                    0,
                    Number(c.payable_before_due) - Number(c.paid_amount),
                  );
                  const paymentCount = c.fee_payments?.length ?? 0;
                  return (
                    <tr
                      key={c.id}
                      className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-mono font-black text-blue-900 dark:text-blue-300">
                          {c.challan_no}
                        </span>
                        <span className="block text-xs text-slate-500">
                          Due: {formatDate(c.due_date)}
                        </span>
                        {c.late_fine_applied_at && (
                          <span className="mt-0.5 inline-block rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            +Late Fine Applied
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <strong className="font-extrabold text-slate-900 dark:text-white">
                            {c.families?.guardian_name ?? "—"}
                          </strong>
                          <span className="rounded bg-indigo-50 px-2 py-0.5 font-mono text-xs font-black text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                            FAM-{c.families?.family_number ?? "—"}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {c.student_fees.map((sf) => {
                            const code = sf.fee_types?.code ?? "MONTHLY";
                            return (
                              <span
                                key={sf.id}
                                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  FEE_BADGE_STYLES[code] ??
                                  "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                }`}
                              >
                                {sf.students?.full_name ?? "Student"} • {code} (
                                {formatCurrency(sf.amount)})
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap text-right font-mono text-slate-700 dark:text-slate-300">
                        {formatCurrency(c.total_gross)}
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {c.total_concession > 0
                          ? `- ${formatCurrency(c.total_concession)}`
                          : "—"}
                      </td>

                      <td
                        className={`px-4 py-4 whitespace-nowrap text-right font-mono ${
                          c.total_arrears > 0
                            ? "font-black text-rose-600"
                            : "text-slate-400"
                        }`}
                      >
                        {c.total_arrears > 0
                          ? `+ ${formatCurrency(c.total_arrears)}`
                          : "0"}
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap text-right font-mono font-black text-blue-950 dark:text-white">
                        {formatCurrency(c.payable_before_due)}
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(c.paid_amount)}
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <Badge variant={statusVariant(c.status)}>
                          {c.status === "partial"
                            ? `Partial (${formatCurrency(remainingDue)} due)`
                            : c.status}
                        </Badge>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/print/family-challan/${c.id}?autoprint=1`}
                            target="_blank"
                            className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-extrabold text-blue-700 transition hover:bg-blue-600 hover:text-white dark:bg-blue-950 dark:text-blue-300"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span>Slip</span>
                          </Link>

                          {paymentCount > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setHistoryChallanId(c.id);
                                setReversingPaymentId(null);
                                setReversalReason("");
                              }}
                              className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                            >
                              <ReceiptText className="h-3.5 w-3.5" />
                              <span>Receipts ({paymentCount})</span>
                            </button>
                          )}

                          {perms.canCollect && c.status !== "paid" && remainingDue > 0 && (
                            <button
                              type="button"
                              onClick={() => openCollectModal(c)}
                              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-extrabold text-white transition hover:bg-emerald-700 cursor-pointer"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Collect Fee</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. BILLING RUN MODAL (Choose Monthly / Exam / Books / Promotion) */}
      <Modal
        open={billingModalOpen}
        onClose={() => setBillingModalOpen(false)}
        title="Run Family Fee Billing"
        subtitle={`Billing Month: ${selectedMonth || "Enter Month"} • Regenerating never reduces already paid amounts`}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleGenerateRoll} className="space-y-4 text-sm">
          <div className="space-y-2.5">
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-800/50 cursor-pointer">
              <input
                type="checkbox"
                checked={includeMonthly}
                onChange={(e) => setIncludeMonthly(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <div>
                <p className="font-extrabold text-slate-900 dark:text-white">
                  Monthly Tuition Fee
                </p>
                <p className="text-xs text-slate-500">
                  Applies automatic sibling concessions (1st: 0%, 2nd: 20%, 3rd+: 50%) on monthly tuition only, plus prior unpaid arrears.
                </p>
              </div>
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-800/50">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeExam}
                  onChange={(e) => setIncludeExam(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-purple-600"
                />
                <div>
                  <p className="font-extrabold text-slate-900 dark:text-white">
                    Examination Fee (Per Term)
                  </p>
                  <p className="text-xs text-slate-500">
                    Billed once per named exam term per student (no sibling discount).
                  </p>
                </div>
              </label>
              {includeExam && (
                <div className="mt-3 pl-7">
                  <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
                    Exam Term Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={examTerm}
                    onChange={(e) => setExamTerm(e.target.value)}
                    placeholder="e.g. Mid-Term, Final Term"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              )}
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-800/50 cursor-pointer">
              <input
                type="checkbox"
                checked={includeBooks}
                onChange={(e) => setIncludeBooks(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600"
              />
              <div>
                <p className="font-extrabold text-slate-900 dark:text-white">
                  Books &amp; Stationery Fee
                </p>
                <p className="text-xs text-slate-500">
                  Safeguarded to bill strictly once per student per academic session (skips already-billed students).
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-800/50 cursor-pointer">
              <input
                type="checkbox"
                checked={includePromotion}
                onChange={(e) => setIncludePromotion(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600"
              />
              <div>
                <p className="font-extrabold text-slate-900 dark:text-white">
                  Class Promotion Fee
                </p>
                <p className="text-xs text-slate-500">
                  Normally auto-charged on class promotion; enabling here bills any unbilled students strictly once per session.
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setBillingModalOpen(false)}
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-black text-slate-950 shadow-md hover:bg-amber-300 disabled:opacity-60 cursor-pointer"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span>{generating ? "Generating..." : "Run Billing"}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* 5. FOOL-PROOF COLLECT PAYMENT MODAL */}
      <Modal
        open={Boolean(activeChallan)}
        onClose={() => {
          if (submittingPayment) return;
          setActiveChallan(null);
          setConfirmPaymentStep(false);
          setCompletedReceipt(null);
        }}
        title={completedReceipt ? "Payment Posted & Receipt Ready" : "Record Fee Payment"}
        subtitle={
          activeChallan
            ? `FAM-${activeChallan.families?.family_number} • ${activeChallan.families?.guardian_name} • ${activeChallan.challan_no}`
            : undefined
        }
        maxWidthClass="max-w-lg"
      >
        {activeChallan && completedReceipt && (
          <div className="space-y-5 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-emerald-600">
                Official Receipt Generated
              </p>
              <p className="mt-1 font-mono text-2xl font-black text-slate-900 dark:text-white">
                {completedReceipt.receipt_no}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
                Received {formatCurrency(completedReceipt.amount_paid)} from{" "}
                <strong>{activeChallan.families?.guardian_name}</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
              <Link
                href={`/print/receipt/${completedReceipt.id}?autoprint=1`}
                target="_blank"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-black text-white shadow-md hover:bg-blue-800"
              >
                <Printer className="h-4 w-4" />
                <span>Print Official Receipt</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setActiveChallan(null);
                  setCompletedReceipt(null);
                }}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {activeChallan && !completedReceipt && !confirmPaymentStep && (
          <form onSubmit={handleReviewPayment} className="space-y-4 text-sm">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-500">Challan Total:</span>
                <span className="font-mono">
                  {formatCurrency(activeChallan.payable_before_due)}
                </span>
              </div>
              <div className="mt-1 flex justify-between font-semibold">
                <span className="text-slate-500">Already Paid:</span>
                <span className="font-mono text-emerald-600">
                  {formatCurrency(activeChallan.paid_amount)}
                </span>
              </div>
              <div className="mt-2 flex justify-between border-t border-blue-200 pt-2 text-base font-black text-rose-700 dark:border-slate-600 dark:text-rose-400">
                <span>Remaining Dues:</span>
                <span className="font-mono">{formatCurrency(activeRemainingDue)}</span>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Payment Amount (Rs.) <span className="text-rose-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setCollectAmount(String(Math.round(activeRemainingDue)))}
                  className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-extrabold text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 cursor-pointer"
                >
                  Pay Full ({formatCurrency(activeRemainingDue)})
                </button>
              </div>
              <input
                type="number"
                min="1"
                max={activeRemainingDue}
                step="1"
                required
                value={collectAmount}
                onChange={(e) => setCollectAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-3 font-mono text-lg font-black text-blue-950 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              {/* Live balance after payment preview */}
              <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2 text-xs font-bold dark:bg-slate-800/70">
                <span className="text-slate-500">Balance After Payment:</span>
                {parsedCollectAmount > activeRemainingDue ? (
                  <span className="text-rose-600">
                    Exceeds remaining due by {formatCurrency(parsedCollectAmount - activeRemainingDue)}
                  </span>
                ) : balanceAfterPayment === 0 && isValidAmount ? (
                  <span className="text-emerald-600">Rs. 0 (PAID IN FULL)</span>
                ) : (
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {formatCurrency(balanceAfterPayment)}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                Payment Method
              </label>
              <select
                value={collectMethod}
                onChange={(e) => setCollectMethod(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="Cash">Cash (School Counter)</option>
                <option value="Bank Deposit">Bank Deposit (HBL / Meezan)</option>
                <option value="Online Transfer">Online IBFT Banking</option>
                <option value="JazzCash">JazzCash</option>
                <option value="EasyPaisa">EasyPaisa</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                Transaction / Deposit Slip Reference{" "}
                {referenceRequired ? (
                  <span className="text-rose-600">* (Required for {collectMethod})</span>
                ) : (
                  <span className="text-xs font-normal text-slate-400">(Optional for Cash)</span>
                )}
              </label>
              <input
                type="text"
                required={referenceRequired}
                value={collectReference}
                onChange={(e) => setCollectReference(e.target.value)}
                placeholder="e.g. HBL Slip # 98402, JazzCash TID"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">
                Remarks (Optional)
              </label>
              <input
                type="text"
                value={collectNotes}
                onChange={(e) => setCollectNotes(e.target.value)}
                placeholder="Optional note..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveChallan(null)}
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValidAmount}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-black text-white shadow-md hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
              >
                <span>Review Payment</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}

        {activeChallan && !completedReceipt && confirmPaymentStep && (
          <div className="space-y-5 text-sm">
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
              <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Final Payment Confirmation
              </p>
              <p className="mt-2 text-base font-black text-slate-900 dark:text-white">
                Collect {formatCurrency(parsedCollectAmount)} from FAM-
                {activeChallan.families?.family_number} ({activeChallan.families?.guardian_name})?
              </p>
              <dl className="mt-3 space-y-1.5 border-t border-emerald-200/80 pt-3 text-xs dark:border-emerald-900/50">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Payment Method:</dt>
                  <dd className="font-bold text-slate-900 dark:text-white">{collectMethod}</dd>
                </div>
                {collectReference.trim() && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Reference:</dt>
                    <dd className="font-mono font-bold text-slate-900 dark:text-white">
                      {collectReference.trim()}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-slate-500">Balance After Payment:</dt>
                  <dd className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(balanceAfterPayment)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                disabled={submittingPayment}
                onClick={() => setConfirmPaymentStep(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Edit Details
              </button>
              <button
                type="button"
                disabled={submittingPayment}
                onClick={handleConfirmPayment}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-md hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
              >
                {submittingPayment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>{submittingPayment ? "Posting..." : "Confirm & Post Receipt"}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 6. PAYMENT RECEIPTS & ADMINISTRATOR REVERSAL MODAL */}
      <Modal
        open={Boolean(historyChallan)}
        onClose={() => {
          setHistoryChallanId(null);
          setReversingPaymentId(null);
          setReversalReason("");
        }}
        title={
          historyChallan
            ? `Payment Receipts — ${historyChallan.challan_no}`
            : "Payment Receipts"
        }
        subtitle={
          historyChallan
            ? `FAM-${historyChallan.families?.family_number} • ${historyChallan.families?.guardian_name} • Payments are never deleted`
            : undefined
        }
        maxWidthClass="max-w-2xl"
      >
        {historyChallan && (
          <div className="space-y-4">
            {historyChallan.fee_payments.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No payment receipts recorded for this challan yet.
              </p>
            ) : (
              <ul className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
                {historyChallan.fee_payments.map((pmt) => {
                  const isReversed = pmt.status === "reversed";
                  const isReversingThis = reversingPaymentId === pmt.id;
                  return (
                    <li
                      key={pmt.id}
                      className={`rounded-2xl border p-4 ${
                        isReversed
                          ? "border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20"
                          : "border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/50"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-black text-blue-950 dark:text-white">
                              {pmt.receipt_no}
                            </span>
                            <Badge variant={isReversed ? "rose" : "emerald"}>
                              {isReversed ? "REVERSED" : "POSTED"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                            {formatDate(pmt.payment_date)} • {pmt.payment_method}
                            {pmt.transaction_reference
                              ? ` • Ref: ${pmt.transaction_reference}`
                              : ""}{" "}
                            • By {pmt.users?.name ?? "Staff"}
                          </p>
                        </div>

                        <div className="text-right">
                          <p
                            className={`font-mono text-base font-black ${
                              isReversed
                                ? "text-rose-600 line-through"
                                : "text-emerald-700 dark:text-emerald-400"
                            }`}
                          >
                            {formatCurrency(pmt.amount_paid)}
                          </p>
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <Link
                              href={`/print/receipt/${pmt.id}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-600 hover:text-white dark:bg-blue-950 dark:text-blue-300"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              <span>Print Receipt</span>
                            </Link>
                            {perms.canReverse && !isReversed && !isReversingThis && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReversingPaymentId(pmt.id);
                                  setReversalReason("");
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-600 hover:text-white dark:bg-rose-950 dark:text-rose-300 cursor-pointer"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Reverse</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {isReversed && (
                        <div className="mt-3 rounded-xl border border-rose-200 bg-white/80 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-slate-900/60 dark:text-rose-300">
                          <p className="font-bold">
                            Reversed on {formatDate(pmt.reversed_at)} by{" "}
                            {pmt.users_fee_payments_reversed_by_user_idTousers?.name ??
                              "Administrator"}
                          </p>
                          <p className="mt-0.5">
                            <strong>Reason:</strong> {pmt.reversal_reason}
                          </p>
                        </div>
                      )}

                      {isReversingThis && (
                        <div className="mt-3 space-y-2.5 rounded-xl border-2 border-rose-200 bg-white p-3.5 dark:border-rose-900 dark:bg-slate-900">
                          <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-700 dark:text-rose-400">
                            <AlertTriangle className="h-4 w-4" />
                            <span>Administrator Reversal (Minimum 10 characters reason required)</span>
                          </div>
                          <textarea
                            rows={2}
                            value={reversalReason}
                            onChange={(e) => setReversalReason(e.target.value)}
                            placeholder="Explain why this payment is being reversed (e.g. Wrong family selected, cheque dishonored)..."
                            className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={submittingReversal}
                              onClick={() => {
                                setReversingPaymentId(null);
                                setReversalReason("");
                              }}
                              className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={submittingReversal || reversalReason.trim().length < 10}
                              onClick={() => handleReversePayment(pmt.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                            >
                              {submittingReversal && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              )}
                              <span>Confirm Reversal</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Download,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";

interface AuditLogEntry {
  id: number;
  user_id: number | null;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  reason: string | null;
  ip_address: string | null;
  created_at: string;
}

interface UserOption {
  id: number;
  name: string;
  email: string;
}

const ACTION_OPTIONS = [
  { value: "", label: "All Audit Actions" },
  { value: "FEE_AMOUNT_CHANGED", label: "Fee Amount Changed" },
  { value: "PAYMENT_RECORDED", label: "Payment Recorded" },
  { value: "PAYMENT_REVERSED", label: "Payment Reversed" },
  { value: "CHALLAN_GENERATED", label: "Challan Generated" },
  { value: "PROMOTION_FEE_CHARGED", label: "Promotion Fee Charged" },
  { value: "LATE_FINE_APPLIED", label: "Late Fine Applied" },
  { value: "LOGIN_DENIED_FEE_EDIT", label: "Denied Fee Edit Attempt" },
];

function actionBadgeVariant(action: string): "blue" | "emerald" | "rose" | "amber" | "slate" {
  switch (action) {
    case "PAYMENT_RECORDED":
      return "emerald";
    case "PAYMENT_REVERSED":
    case "LOGIN_DENIED_FEE_EDIT":
      return "rose";
    case "FEE_AMOUNT_CHANGED":
    case "LATE_FINE_APPLIED":
      return "amber";
    case "CHALLAN_GENERATED":
    case "PROMOTION_FEE_CHARGED":
      return "blue";
    default:
      return "slate";
  }
}

function formatSummaryPairs(obj: Record<string, unknown> | null): string[] {
  if (!obj) return [];
  return Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => {
      const label = k.replace(/_/g, " ");
      const formatted = typeof v === "object" ? JSON.stringify(v) : String(v);
      return `${label}: ${formatted}`;
    });
}

export default function FeeAuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbiddenMessage, setForbiddenMessage] = useState<string | null>(null);

  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(t);
  }, [query]);

  const buildQueryString = useCallback(
    (extra?: Record<string, string>) => {
      const qs = new URLSearchParams();
      if (actionFilter) qs.set("action", actionFilter);
      if (userFilter) qs.set("userId", userFilter);
      if (fromDate) qs.set("from", fromDate);
      if (toDate) qs.set("to", toDate);
      if (debouncedQuery.trim()) qs.set("q", debouncedQuery.trim());
      if (extra) {
        for (const [k, v] of Object.entries(extra)) {
          qs.set(k, v);
        }
      }
      return qs.toString();
    },
    [actionFilter, userFilter, fromDate, toDate, debouncedQuery],
  );

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setForbiddenMessage(null);
    try {
      const qs = buildQueryString();
      const res = await fetch(`/api/admin/fee-audit?${qs}`);
      const json = await res.json();
      if (res.status === 403) {
        setForbiddenMessage(
          json.error || "Forbidden: Only the Administrator can access fee audit logs.",
        );
        return;
      }
      if (res.ok) {
        setLogs(json.logs ?? []);
        setUsers(json.users ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [buildQueryString]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const exportCsvUrl = `/api/admin/fee-audit?${buildQueryString({ format: "csv" })}`;

  if (forbiddenMessage) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <div className="rounded-3xl border border-rose-200 bg-white p-8 shadow-sm dark:border-rose-900/60 dark:bg-slate-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-black text-slate-900 dark:text-white">
            Administrator Access Required
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {forbiddenMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Immutable Financial Security"
        title="Fee Audit Trail"
        description="Tamper-proof append-only record of every fee rate edit, challan run, payment receipt, reversal, late fine, and blocked unauthorized attempt."
        icon={<ShieldAlert className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={loadLogs}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
            <a
              href={exportCsvUrl}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-800"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </a>
          </div>
        }
      />

      {/* Immutability Notice */}
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-3.5 text-sm font-semibold text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
        <span>
          Protected by PostgreSQL trigger <code className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-xs dark:bg-emerald-900/60">trg_prevent_fee_audit_mutation</code> — records cannot be updated or deleted.
        </span>
      </div>

      {/* Filters */}
      <section className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
            Action
          </label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
            User
          </label>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">All Users</option>
            {users.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
            From Date
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
            To Date
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-slate-500">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="User, reason, entity, IP..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>
      </section>

      {/* Audit Table */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="flex justify-center py-20 text-blue-600">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            No audit events match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:bg-slate-800/70 dark:text-slate-300">
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-5 py-3.5">Action</th>
                  <th className="px-5 py-3.5">Old → New Values</th>
                  <th className="px-5 py-3.5">Reason / IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((row) => {
                  const oldPairs = formatSummaryPairs(row.old_values);
                  const newPairs = formatSummaryPairs(row.new_values);
                  return (
                    <tr
                      key={row.id}
                      className="align-top transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-4 whitespace-nowrap">
                        <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {formatDate(row.created_at)}
                        </p>
                        <p className="font-mono text-xs text-slate-500">
                          {new Date(row.created_at).toLocaleTimeString("en-PK", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </p>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <p className="font-bold text-slate-900 dark:text-white">
                          {row.user_name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {row.entity_type}
                          {row.entity_id != null ? ` #${row.entity_id}` : ""}
                        </p>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <Badge variant={actionBadgeVariant(row.action)}>
                          {row.action}
                        </Badge>
                      </td>

                      <td className="px-5 py-4 max-w-md space-y-1.5 text-xs">
                        {oldPairs.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="font-extrabold uppercase text-slate-400">
                              Old:
                            </span>
                            {oldPairs.map((pair) => (
                              <span
                                key={pair}
                                className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              >
                                {pair}
                              </span>
                            ))}
                          </div>
                        )}
                        {newPairs.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="font-extrabold uppercase text-blue-500">
                              New:
                            </span>
                            {newPairs.map((pair) => (
                              <span
                                key={pair}
                                className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-blue-900 dark:bg-blue-950/60 dark:text-blue-200"
                              >
                                {pair}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-600 dark:text-slate-400">
                        {row.reason && (
                          <p className="font-medium text-slate-800 dark:text-slate-200">
                            {row.reason}
                          </p>
                        )}
                        {row.ip_address && (
                          <p className="mt-1 font-mono text-[11px] text-slate-400">
                            IP: {row.ip_address}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

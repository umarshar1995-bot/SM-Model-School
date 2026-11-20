"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Home,
  Loader2,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";

interface FamilyRow {
  id: number;
  family_number: number;
  guardian_name: string;
  guardian_mobile: string | null;
  guardian_cnic: string | null;
  address: string | null;
  is_active: boolean;
  students_count: number;
  outstanding_dues: number;
}

export default function FamiliesPage() {
  const searchParams = useSearchParams();
  const [families, setFamilies] = useState<FamilyRow[]>([]);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [trashed, setTrashed] = useState(false);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FamilyRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    guardian_name: "",
    guardian_mobile: "",
    guardian_cnic: "",
    address: "",
    is_active: true,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("q", search.trim());
      if (trashed) qs.set("trashed", "1");
      const res = await fetch(`/api/admin/families?${qs.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setFamilies(json.families ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [search, trashed]);

  useEffect(() => {
    const t = window.setTimeout(loadData, 200);
    return () => window.clearTimeout(t);
  }, [loadData]);

  useEffect(() => {
    if (searchParams.get("new") === "1" && !modalOpen && !editing) {
      openCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openCreate() {
    setEditing(null);
    setForm({
      guardian_name: "",
      guardian_mobile: "",
      guardian_cnic: "",
      address: "",
      is_active: true,
    });
    setModalOpen(true);
  }

  function openEdit(f: FamilyRow) {
    setEditing(f);
    setForm({
      guardian_name: f.guardian_name,
      guardian_mobile: f.guardian_mobile ?? "",
      guardian_cnic: f.guardian_cnic ?? "",
      address: f.address ?? "",
      is_active: f.is_active,
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/families", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          ...form,
        }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Failed to save family.");
        return;
      }
      toast.success(editing ? "Family updated." : "Family registered.");
      setModalOpen(false);
      loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, mode: "soft" | "restore" | "force") {
    if (mode === "force" && !confirm("Permanently delete this family and its linked records?"))
      return;
    const res = await fetch(`/api/admin/families?id=${id}&mode=${mode}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(mode === "restore" ? "Family restored." : "Family archived.");
      loadData();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Guardian Accounts"
        title="Families Directory"
        description="Manage family accounts with auto-generated FAM numbers, sibling grouping, and outstanding dues tracking."
        icon={<Home className="h-5 w-5" />}
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-800 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Register Family</span>
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
            placeholder="Search by guardian name, FAM number, mobile, CNIC..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <button
          type="button"
          onClick={() => setTrashed((t) => !t)}
          className={`rounded-xl px-3 py-2 text-xs font-bold cursor-pointer ${
            trashed
              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
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
                  <th className="px-6 py-3.5">Family ID</th>
                  <th className="px-6 py-3.5">Guardian Name</th>
                  <th className="px-6 py-3.5">Contact & CNIC</th>
                  <th className="px-6 py-3.5">Children</th>
                  <th className="px-6 py-3.5 text-right">Outstanding Dues</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {families.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      No families found.
                    </td>
                  </tr>
                ) : (
                  families.map((fam) => (
                    <tr
                      key={fam.id}
                      className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-6 py-3.5 font-mono font-black text-indigo-700 dark:text-indigo-400">
                        FAM-{fam.family_number}
                      </td>
                      <td className="px-6 py-3.5">
                        <p className="font-extrabold text-slate-900 dark:text-white">
                          {fam.guardian_name}
                        </p>
                        {fam.address && (
                          <p className="text-[11px] text-slate-400 line-clamp-1 max-w-xs">
                            {fam.address}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <p className="inline-flex items-center gap-1 font-mono text-slate-700 dark:text-slate-300">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {fam.guardian_mobile ?? "—"}
                        </p>
                        <p className="font-mono text-[10px] text-slate-400">
                          {fam.guardian_cnic ?? "—"}
                        </p>
                      </td>
                      <td className="px-6 py-3.5">
                        <Badge variant="blue">{fam.students_count} Child(ren)</Badge>
                      </td>
                      <td
                        className={`px-6 py-3.5 text-right font-mono font-black ${
                          fam.outstanding_dues > 0 ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {formatCurrency(fam.outstanding_dues)}
                      </td>
                      <td className="px-6 py-3.5">
                        <Badge variant={fam.is_active ? "emerald" : "slate"} dot>
                          {fam.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-6 py-3.5 text-right whitespace-nowrap">
                        {!trashed ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(fam)}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(fam.id, "soft")}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDelete(fam.id, "restore")}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" /> Restore
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Family FAM-${editing.family_number}` : "Register New Family"}
        subtitle="Family numbers auto-increment starting from 1001. Mobile numbers normalize to 92XXXXXXXXXX."
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold mb-1">Guardian Name *</label>
            <input
              type="text"
              required
              value={form.guardian_name}
              onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold mb-1">Mobile Number</label>
              <input
                type="tel"
                value={form.guardian_mobile}
                onChange={(e) => setForm({ ...form, guardian_mobile: e.target.value })}
                placeholder="0300-1234567"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">CNIC Number</label>
              <input
                type="text"
                value={form.guardian_cnic}
                onChange={(e) => setForm({ ...form, guardian_cnic: e.target.value })}
                placeholder="45203-0000000-0"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1">Residential Address</label>
            <textarea
              rows={3}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <span>Active Family</span>
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
              {saving ? "Saving..." : editing ? "Update Family" : "Register Family"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

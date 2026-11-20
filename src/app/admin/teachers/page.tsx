"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Send,
  Smartphone,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Badge, statusVariant } from "@/components/ui/Badge";
import { formatDate, getInitials, photoUrl } from "@/lib/format";

interface DeviceItem {
  id: number;
  name: string | null;
  last_used_at: string | null;
}

interface TeacherRow {
  id: number;
  user_id: number | null;
  name: string;
  mobile: string | null;
  employee_no: string | null;
  photo_path: string | null;
  status: "active" | "inactive";
  users: { id: number; email: string } | null;
  teacher_devices: DeviceItem[];
  _count: {
    teacher_sections: number;
    teacher_subject_assignments: number;
  };
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [trashed, setTrashed] = useState(false);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    employee_no: "",
    photo_path: "",
    status: "active" as "active" | "inactive",
  });

  // Invite link dialog
  const [inviteModal, setInviteModal] = useState<{
    teacherName: string;
    url: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("q", search.trim());
      if (statusFilter) qs.set("status", statusFilter);
      if (trashed) qs.set("trashed", "1");
      const res = await fetch(`/api/admin/teachers?${qs.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setTeachers(json.teachers ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, trashed]);

  useEffect(() => {
    const t = window.setTimeout(loadData, 200);
    return () => window.clearTimeout(t);
  }, [loadData]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", mobile: "", employee_no: "", photo_path: "", status: "active" });
    setModalOpen(true);
  }

  function openEdit(t: TeacherRow) {
    setEditing(t);
    setForm({
      name: t.name,
      mobile: t.mobile ?? "",
      employee_no: t.employee_no ?? "",
      photo_path: t.photo_path ?? "",
      status: t.status,
    });
    setModalOpen(true);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "teachers");
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const out = await res.json();
    if (res.ok) {
      setForm((prev) => ({ ...prev, photo_path: out.path }));
      toast.success("Photo uploaded.");
    } else {
      toast.error(out.error || "Upload failed.");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/teachers", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          ...form,
        }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Failed to save teacher.");
        return;
      }
      toast.success(editing ? "Teacher updated." : "Teacher added.");
      setModalOpen(false);
      loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleIssueInvite(teacher: TeacherRow) {
    const res = await fetch("/api/admin/teachers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "invite", teacherId: teacher.id }),
    });
    const out = await res.json();
    if (!res.ok) {
      toast.error(out.error || "Failed to issue invite.");
      return;
    }
    setCopied(false);
    setInviteModal({ teacherName: teacher.name, url: out.inviteUrl });
  }

  async function handleRevokeDevice(deviceId: number) {
    if (!confirm("Revoke this teacher's mobile device access?")) return;
    const res = await fetch("/api/admin/teachers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke-device", deviceId }),
    });
    if (res.ok) {
      toast.success("Device revoked.");
      loadData();
    }
  }

  async function handleDelete(id: number, mode: "soft" | "restore") {
    const res = await fetch(`/api/admin/teachers?id=${id}&mode=${mode}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(mode === "restore" ? "Teacher restored." : "Teacher archived.");
      loadData();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Teaching Faculty"
        title="Teachers Directory"
        description="Manage faculty profiles, issue secure 48-hour mobile portal invites, and control registered devices."
        icon={<Users className="h-5 w-5" />}
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Teacher</span>
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
            placeholder="Search by teacher name, employee #, mobile..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          type="button"
          onClick={() => setTrashed((t) => !t)}
          className={`rounded-xl px-3 py-2 text-xs font-bold cursor-pointer ${
            trashed
              ? "bg-rose-100 text-rose-700"
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
                  <th className="px-6 py-3.5">Teacher</th>
                  <th className="px-6 py-3.5">Emp. No</th>
                  <th className="px-6 py-3.5">Mobile</th>
                  <th className="px-6 py-3.5">Assignments</th>
                  <th className="px-6 py-3.5">Portal Access</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {teachers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      No teachers added yet. Click &ldquo;Add Teacher&rdquo; to register teaching staff.
                    </td>
                  </tr>
                ) : (
                  teachers.map((t) => {
                    const pUrl = photoUrl(t.photo_path);
                    return (
                      <tr
                        key={t.id}
                        className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            {pUrl ? (
                              <img
                                src={pUrl}
                                alt={t.name}
                                className="h-9 w-9 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-800">
                                {getInitials(t.name)}
                              </div>
                            )}
                            <div>
                              <p className="font-extrabold text-slate-900 dark:text-white">
                                {t.name}
                              </p>
                              {t.users?.email && (
                                <p className="text-[10px] text-slate-400">{t.users.email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {t.employee_no ?? "—"}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-slate-600 dark:text-slate-300">
                          {t.mobile ?? "Not provided"}
                        </td>
                        <td className="px-6 py-3.5 space-x-1">
                          <Badge variant="sky">{t._count.teacher_sections} Sec</Badge>
                          <Badge variant="amber">
                            {t._count.teacher_subject_assignments} Subj
                          </Badge>
                        </td>
                        <td className="px-6 py-3.5">
                          {t.teacher_devices.length > 0 ? (
                            <div className="space-y-1">
                              {t.teacher_devices.map((d) => (
                                <div key={d.id} className="flex items-center gap-2 text-[11px]">
                                  <Smartphone className="h-3 w-3 text-emerald-500" />
                                  <span className="font-semibold">
                                    {d.name ?? "Phone"}
                                  </span>
                                  <span className="text-slate-400">
                                    ({formatDate(d.last_used_at)})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRevokeDevice(d.id)}
                                    className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                                  >
                                    Revoke
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : t.user_id ? (
                            <Badge variant="emerald">Account Linked</Badge>
                          ) : (
                            <span className="text-slate-400">Not invited yet</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          <Badge variant={statusVariant(t.status)} dot>
                            {t.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-3.5 text-right whitespace-nowrap">
                          {!trashed ? (
                            <div className="inline-flex items-center gap-1">
                              {!t.user_id && (
                                <button
                                  type="button"
                                  onClick={() => handleIssueInvite(t)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-600 hover:text-white transition cursor-pointer"
                                >
                                  <Send className="h-3 w-3" />
                                  <span>Invite</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openEdit(t)}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(t.id, "soft")}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDelete(t.id, "restore")}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 cursor-pointer"
                            >
                              <RotateCcw className="h-3 w-3" /> Restore
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD/EDIT TEACHER MODAL */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Teacher" : "Add Teacher"}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block font-bold mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Mobile Number</label>
              <input
                type="tel"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                placeholder="03XX-XXXXXXX"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Employee Number</label>
              <input
                type="text"
                value={form.employee_no}
                onChange={(e) => setForm({ ...form, employee_no: e.target.value })}
                placeholder="EMP-001"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as "active" | "inactive" })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Photo</label>
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="w-full text-[11px]" />
            </div>
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
              {saving ? "Saving..." : "Save Teacher"}
            </button>
          </div>
        </form>
      </Modal>

      {/* INVITE LINK MODAL */}
      <Modal
        open={Boolean(inviteModal)}
        onClose={() => setInviteModal(null)}
        title="Teacher Portal Invitation Ready"
        subtitle={
          inviteModal
            ? `Send this personal 48-hour one-time setup link to ${inviteModal.teacherName}.`
            : undefined
        }
        maxWidthClass="max-w-lg"
      >
        {inviteModal && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 font-mono text-[11px] break-all text-blue-950 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-200">
              {inviteModal.url}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(inviteModal.url);
                  setCopied(true);
                  toast.success("Invite link copied to clipboard.");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 font-bold text-white hover:bg-blue-800 cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Copied!" : "Copy Invite Link"}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

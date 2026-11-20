"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Settings, Shield, Smartphone, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";

interface SettingItem {
  id: number;
  key: string;
  value: unknown;
  group_name: string | null;
}

interface RoleItem {
  id: number;
  name: string;
  guard_name: string;
  _count: { role_has_permissions: number; model_has_roles: number };
}

interface UserItem {
  id: number;
  name: string;
  email: string;
  created_at: string | null;
  roles: string[];
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role_id: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const json = await res.json();
        setSettings(json.settings ?? []);
        setRoles(json.roles ?? []);
        setUsers(json.users ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const mobileOnlySetting = settings.find(
    (s) => s.key === "teacher_portal_mobile_only",
  );
  const mobileOnlyEnabled = Boolean(mobileOnlySetting?.value ?? true);

  async function toggleMobileOnly() {
    const nextVal = !mobileOnlyEnabled;
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "teacher_portal_mobile_only",
        value: nextVal,
        group_name: "teacher_portal",
      }),
    });
    if (res.ok) {
      toast.success(
        nextVal
          ? "Teacher portal restricted to mobile devices."
          : "Teacher portal enabled on all devices.",
      );
      loadData();
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setSavingUser(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Failed to create account.");
        return;
      }
      toast.success("Staff account created.");
      setUserModalOpen(false);
      setUserForm({ name: "", email: "", password: "", role_id: "" });
      loadData();
    } finally {
      setSavingUser(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System Administration"
        title="Settings, Roles & Accounts"
        description="Configure Teacher Portal policies, view RBAC permission roles, and manage staff login accounts."
        icon={<Settings className="h-5 w-5" />}
        actions={
          <button
            type="button"
            onClick={() => {
              setUserForm({
                name: "",
                email: "",
                password: "",
                role_id: roles[0] ? String(roles[0].id) : "",
              });
              setUserModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>Create Staff Account</span>
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16 text-blue-600">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* PORTAL POLICY CARD */}
          <section className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  <Smartphone className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white">
                    Teacher Portal Mobile-Only Mode
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    When enabled, teachers opening <code className="font-mono">/t</code>{" "}
                    from a desktop browser will be prompted to open the portal on their
                    registered mobile phone.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleMobileOnly}
                className={`rounded-full px-5 py-2 text-xs font-black transition cursor-pointer ${
                  mobileOnlyEnabled
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {mobileOnlyEnabled ? "Enabled (Mobile Only)" : "Disabled (All Devices)"}
              </button>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* RBAC ROLES */}
            <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <Shield className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  Access Roles ({roles.length})
                </h2>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-5 py-3">Role Name</th>
                    <th className="px-5 py-3">Permissions</th>
                    <th className="px-5 py-3">Users</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {roles.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-3 font-extrabold text-slate-900 dark:text-white">
                        {r.name}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="blue">
                          {r._count.role_has_permissions} permissions
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="indigo">{r._count.model_has_roles} assigned</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* USERS LIST */}
            <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  Staff User Accounts ({users.length})
                </h2>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">Role(s)</th>
                    <th className="px-5 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-5 py-3">
                        <p className="font-bold text-slate-900 dark:text-white">{u.name}</p>
                        <p className="text-[11px] text-slate-400">{u.email}</p>
                      </td>
                      <td className="px-5 py-3 space-x-1">
                        {u.roles.length > 0 ? (
                          u.roles.map((rn) => (
                            <Badge key={rn} variant="emerald">
                              {rn}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-400">No role</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {formatDate(u.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      )}

      <Modal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title="Create Staff Account"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={userForm.name}
              onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block font-bold mb-1">Email *</label>
            <input
              type="email"
              required
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block font-bold mb-1">Password (min 8 chars) *</label>
            <input
              type="password"
              required
              minLength={8}
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block font-bold mb-1">Role *</label>
            <select
              required
              value={userForm.role_id}
              onChange={(e) => setUserForm({ ...userForm, role_id: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            >
              {roles.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setUserModalOpen(false)}
              className="rounded-xl px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingUser}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-5 py-2 font-bold text-white hover:bg-blue-800 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{savingUser ? "Creating..." : "Create Account"}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

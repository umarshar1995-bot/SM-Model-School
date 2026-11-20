"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function InviteAcceptForm({
  token,
  teacherName,
}: {
  token: string;
  teacherName: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/invite/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          password_confirmation: confirmPassword,
          device_name: deviceName || null,
        }),
      });
      const out = await res.json();
      if (!res.ok) {
        setError(out.error || "Unable to complete setup.");
        toast.error(out.error || "Setup failed.");
        return;
      }
      toast.success("Your teacher portal is ready!");
      router.push("/t");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-3xl border border-blue-100 bg-white p-7 shadow-xl">
      <p className="text-xs font-extrabold uppercase tracking-widest text-blue-700">
        Shabiran Mustafa Public School
      </p>
      <h1 className="mt-2 text-2xl font-black text-blue-950">
        Set up your teacher portal
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Welcome, <strong>{teacherName}</strong>. This personal link expires in 48 hours and
        can be used once.
      </p>

      {error && (
        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-xs">
        <div>
          <label className="block font-bold text-slate-700 mb-1">Email Address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full min-h-11 rounded-xl border border-blue-200 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="block font-bold text-slate-700 mb-1">Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full min-h-11 rounded-xl border border-blue-200 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="block font-bold text-slate-700 mb-1">Confirm Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full min-h-11 rounded-xl border border-blue-200 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
          />
        </div>
        <div>
          <label className="block font-bold text-slate-700 mb-1">
            Device Name <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="My phone"
            className="w-full min-h-11 rounded-xl border border-blue-200 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>Open Teacher Portal</span>
        </button>
      </form>
    </section>
  );
}

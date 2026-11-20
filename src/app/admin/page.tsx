"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Banknote,
  Building2,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Filter,
  GraduationCap,
  Home,
  Loader2,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge, statusVariant } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/format";

interface SessionItem {
  id: number;
  name: string;
  is_current: boolean;
}

interface EnrollmentRow {
  id: number;
  roll_no: string | null;
  status: string;
  admission_date: string | null;
  students: {
    id: number;
    full_name: string;
    admission_no: string | null;
  } | null;
  school_classes: { name: string } | null;
  class_sections: { name: string } | null;
  academic_sessions: { name: string } | null;
}

interface DashboardResponse {
  sessions: SessionItem[];
  selectedSession: SessionItem | null;
  stats: {
    totalStudents: number;
    maleStudents: number;
    femaleStudents: number;
    totalTeachers: number;
    totalClasses: number;
    totalFamilies: number;
    enrolledInSession: number;
    newEnrollmentsThisMonth: number;
    totalBilled: number;
    totalCollected: number;
    totalOutstanding: number;
    recoveryRate: number;
  };
  enrollmentTrends: { month: string; enrollments: number }[];
  classDistribution: { name: string; students: number }[];
  recentEnrollments: EnrollmentRow[];
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [chartFilter, setChartFilter] = useState<"current" | "last">("current");
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Administrator");
  const [nowLabel, setNowLabel] = useState("");

  useEffect(() => {
    setNowLabel(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }) +
        " • " +
        new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
    );
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user?.name) setUserName(d.user.name);
      })
      .catch(() => {});
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (sessionId) qs.set("sessionId", sessionId);
      qs.set("chartFilter", chartFilter);
      const res = await fetch(`/api/admin/dashboard?${qs.toString()}`);
      if (res.ok) {
        const json = (await res.json()) as DashboardResponse;
        setData(json);
        if (!sessionId && json.selectedSession) {
          setSessionId(String(json.selectedSession.id));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, chartFilter]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const stats = data?.stats;
  const totalGender = (stats?.maleStudents ?? 0) + (stats?.femaleStudents ?? 0);
  const malePct =
    totalGender > 0 ? Math.round(((stats?.maleStudents ?? 0) / totalGender) * 1000) / 10 : 0;
  const femalePct =
    totalGender > 0 ? Math.round(((stats?.femaleStudents ?? 0) / totalGender) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      {/* HERO BANNER */}
      <section className="school-hero-gradient relative overflow-hidden rounded-3xl p-7 text-white shadow-xl sm:p-9">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
                <GraduationCap className="h-6 w-6 text-amber-300" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                  Welcome back, {userName}
                </h1>
                <p className="text-xs font-medium text-blue-100/85 sm:text-sm">
                  SM Public School — Executive Dashboard Overview
                </p>
              </div>
            </div>
            {nowLabel && (
              <p className="text-xs font-medium text-blue-100/70">{nowLabel}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/admin/students?new=1"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/20 hover:-translate-y-0.5"
            >
              <UserPlus className="h-4 w-4 text-amber-300" />
              <span>Add Student</span>
            </Link>
            <Link
              href="/admin/families?new=1"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/20 hover:-translate-y-0.5"
            >
              <Home className="h-4 w-4 text-sky-200" />
              <span>Add Family</span>
            </Link>
            <Link
              href="/admin/enrollments?new=1"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/20 hover:-translate-y-0.5"
            >
              <ClipboardList className="h-4 w-4 text-emerald-300" />
              <span>Enroll</span>
            </Link>
            <Link
              href="/admin/fees-console"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-black text-slate-950 shadow-md transition hover:bg-amber-300 hover:-translate-y-0.5"
            >
              <Banknote className="h-4 w-4" />
              <span>Fees Console</span>
            </Link>
          </div>
        </div>
      </section>

      {/* SESSION FILTER */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-100/80 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
          <Filter className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-extrabold uppercase tracking-wider">
            Academic Year Scope
          </span>
        </div>

        <div className="flex items-center gap-3">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
          <select
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="min-w-52 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {(data?.sessions ?? []).map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name} {s.is_current ? "(Current)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* PRIMARY 4 KPI CARDS */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Total Students
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <GraduationCap className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
            {stats?.totalStudents ?? 0}
          </p>
          <p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {stats?.enrolledInSession ?? 0} enrolled in{" "}
            {data?.selectedSession?.name ?? "current session"}
          </p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Active Teachers
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
              <Users className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
            {stats?.totalTeachers ?? 0}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Active teaching staff directory
          </p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Active Classes
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <Building2 className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
            {stats?.totalClasses ?? 0}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Prep through Class 12 levels
          </p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Registered Families
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Home className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
            {stats?.totalFamilies ?? 0}
          </p>
          <p className="mt-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
            {(stats?.newEnrollmentsThisMonth ?? 0) > 0
              ? `+${stats?.newEnrollmentsThisMonth} new enrollments this month`
              : "Active guardian accounts"}
          </p>
        </div>
      </section>

      {/* SECONDARY ROW: GENDER, ATTENDANCE & FEE RECOVERY */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Fee Recovery Rate
            </span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {stats?.recoveryRate ?? 0}%
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Collected {formatCurrency(stats?.totalCollected)} of{" "}
            {formatCurrency(stats?.totalBilled)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Outstanding Dues
            </span>
            <Banknote className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400">
            {formatCurrency(stats?.totalOutstanding)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Unpaid & partial family challans
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Student Gender Split
          </span>
          <div className="mt-2 flex items-baseline gap-4">
            <span className="text-lg font-black text-blue-600 dark:text-blue-400">
              {stats?.maleStudents ?? 0}{" "}
              <span className="text-xs font-semibold text-slate-400">Boys ({malePct}%)</span>
            </span>
            <span className="text-lg font-black text-pink-600 dark:text-pink-400">
              {stats?.femaleStudents ?? 0}{" "}
              <span className="text-xs font-semibold text-slate-400">
                Girls ({femalePct}%)
              </span>
            </span>
          </div>
          <div className="mt-2.5 flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="bg-blue-600" style={{ width: `${malePct}%` }} />
            <div className="bg-pink-500" style={{ width: `${femalePct}%` }} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Today&apos;s Attendance
            </span>
            <CheckCircle2 className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-800 dark:text-slate-200">
            Ready
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Leave records active in 360° Student Console
          </p>
        </div>
      </section>

      {/* CHARTS ROW */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-2xl border border-blue-100/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Student Enrollment Trends
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monthly admissions & enrollments across the selected academic session
              </p>
            </div>
            <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              {(["current", "last"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setChartFilter(tab)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    chartFilter === tab
                      ? "bg-white text-blue-700 shadow-xs dark:bg-slate-700 dark:text-blue-300"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                  }`}
                >
                  {tab === "current" ? "Current Session" : "Last Session"}
                </button>
              ))}
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.enrollmentTrends ?? []}>
                <defs>
                  <linearGradient id="enrollFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.45} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="enrollments"
                  name="Enrollments"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill="url(#enrollFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-100/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5">
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              Class Distribution
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Active students by class level
            </p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.classDistribution ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.45} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="students"
                  name="Students"
                  fill="#4f46e5"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* RECENT ENROLLMENTS TABLE */}
      <section className="overflow-hidden rounded-2xl border border-blue-100/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white">
              Recent Active Enrollments
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Latest students enrolled across classes and sections
            </p>
          </div>
          <Link
            href="/admin/classes-and-sections"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 transition"
          >
            <span>Open Class Console</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3">Student</th>
                <th className="px-6 py-3">Admission No</th>
                <th className="px-6 py-3">Class & Section</th>
                <th className="px-6 py-3">Roll No</th>
                <th className="px-6 py-3">Session</th>
                <th className="px-6 py-3">Admitted</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Quick View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(data?.recentEnrollments ?? []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                    No active enrollments found for this session.
                  </td>
                </tr>
              ) : (
                (data?.recentEnrollments ?? []).map((enr) => (
                  <tr
                    key={enr.id}
                    className="transition hover:bg-blue-50/40 dark:hover:bg-blue-950/20"
                  >
                    <td className="px-6 py-3.5 font-bold text-slate-900 dark:text-white">
                      {enr.students?.full_name ?? "—"}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-blue-700 dark:text-blue-400 font-semibold">
                      {enr.students?.admission_no ?? "—"}
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge variant="emerald">{enr.school_classes?.name ?? "—"}</Badge>{" "}
                      <Badge variant="sky">{enr.class_sections?.name ?? "—"}</Badge>
                    </td>
                    <td className="px-6 py-3.5 font-mono font-bold text-amber-700 dark:text-amber-400">
                      {enr.roll_no ?? "—"}
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge variant="blue">{enr.academic_sessions?.name ?? "—"}</Badge>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500">
                      {formatDate(enr.admission_date)}
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge variant={statusVariant(enr.status)} dot>
                        {enr.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {enr.students && (
                        <Link
                          href={`/admin/classes-and-sections?studentId=${enr.students.id}`}
                          className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700 dark:bg-slate-700 transition"
                        >
                          360° Profile
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

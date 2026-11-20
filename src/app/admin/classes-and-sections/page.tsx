"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  GraduationCap,
  Grid2x2,
  Home,
  IdCard,
  Loader2,
  Plus,
  Printer,
  Search,
  User,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge, statusVariant } from "@/components/ui/Badge";
import {
  formatCurrency,
  formatDate,
  getInitials,
  photoUrl,
} from "@/lib/format";

interface SessionItem {
  id: number;
  name: string;
  is_current: boolean;
}

interface SectionItem {
  id: number;
  name: string;
  capacity: number | null;
  users?: { id: number; name: string } | null;
}

interface ClassItem {
  id: number;
  name: string;
  class_sections: SectionItem[];
}

interface FamilyItem {
  id: number;
  family_number: number;
  guardian_name: string;
  guardian_mobile: string | null;
  guardian_cnic: string | null;
  address: string | null;
}

interface StudentItem {
  id: number;
  full_name: string;
  admission_no: string | null;
  gender: string;
  dob: string;
  b_form_no: string | null;
  photo_path: string | null;
  previous_school: string | null;
  admission_date: string;
  status: string;
  families: FamilyItem | null;
}

interface EnrollmentItem {
  id: number;
  roll_no: string | null;
  status: string;
  students: StudentItem | null;
  school_classes: { id: number; name: string } | null;
  class_sections: { id: number; name: string } | null;
}

interface LeaveItem {
  id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: string;
  approved_by: string | null;
}

interface FeeItem {
  id: number;
  challan_no: string;
  billing_month: string;
  fee_type: string;
  amount: number;
  concession_amount: number;
  paid_amount: number;
  due_amount: number;
  due_date: string;
  payment_method: string | null;
  status: string;
}

interface SiblingItem {
  id: number;
  full_name: string;
  admission_no: string | null;
  gender: string;
  student_enrollments: {
    roll_no: string | null;
    school_classes: { name: string } | null;
    class_sections: { name: string } | null;
  }[];
}

interface ConsolePayload {
  sessions: SessionItem[];
  classes: ClassItem[];
  sections: SectionItem[];
  selectedSessionId: number | null;
  selectedClassId: number | null;
  selectedSectionId: number | null;
  currentClass: ClassItem | null;
  currentSection: SectionItem | null;
  enrollments: EnrollmentItem[];
  stats: {
    totalStudents: number;
    boysCount: number;
    girlsCount: number;
    capacity: number;
    occupancyPercent: number;
    classTeacherName: string;
  };
  student360: {
    student: StudentItem;
    enrollment: EnrollmentItem | null;
    siblings: SiblingItem[];
    leaves: LeaveItem[];
    fees: FeeItem[];
    latestFamilyChallanId: number | null;
  } | null;
}

export default function ClassSectionConsolePage() {
  const searchParams = useSearchParams();
  const initialStudentParam = searchParams.get("studentId");

  const [data, setData] = useState<ConsolePayload | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [classId, setClassId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeStudentId, setActiveStudentId] = useState<number | null>(
    initialStudentParam ? Number(initialStudentParam) : null,
  );
  const [activeTab, setActiveTab] = useState<"overview" | "siblings" | "leaves" | "fees">(
    "overview",
  );
  const [loading, setLoading] = useState(true);

  // Add leave quick form inside 360Â° modal
  const [leaveFormOpen, setLeaveFormOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("Sick Leave");
  const [leaveStart, setLeaveStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveEnd, setLeaveEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState("");
  const [savingLeave, setSavingLeave] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery), 260);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  const fetchConsole = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (sessionId) qs.set("sessionId", sessionId);
      if (classId) qs.set("classId", classId);
      if (sectionId) qs.set("sectionId", sectionId);
      if (debouncedSearch.trim()) qs.set("q", debouncedSearch.trim());
      if (activeStudentId) qs.set("studentId", String(activeStudentId));

      const res = await fetch(`/api/admin/console?${qs.toString()}`);
      if (res.ok) {
        const json = (await res.json()) as ConsolePayload;
        setData(json);
        if (!sessionId && json.selectedSessionId) {
          setSessionId(String(json.selectedSessionId));
        }
        if (!classId && json.selectedClassId) {
          setClassId(String(json.selectedClassId));
        }
        if (!sectionId && json.selectedSectionId) {
          setSectionId(String(json.selectedSectionId));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, classId, sectionId, debouncedSearch, activeStudentId]);

  useEffect(() => {
    fetchConsole();
  }, [fetchConsole]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveStudentId(null);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  function handleClassChange(nextClassId: string) {
    setClassId(nextClassId);
    const chosen = data?.classes.find((c) => String(c.id) === nextClassId);
    const firstSec = chosen?.class_sections[0];
    setSectionId(firstSec ? String(firstSec.id) : "all");
    setSearchQuery("");
  }

  async function handleCreateLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!activeStudentId) return;
    setSavingLeave(true);
    try {
      const res = await fetch(`/api/admin/students/${activeStudentId}/leaves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academic_session_id: sessionId || null,
          leave_type: leaveType,
          start_date: leaveStart,
          end_date: leaveEnd,
          reason: leaveReason,
          status: "approved",
        }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Failed to record leave.");
        return;
      }
      toast.success("Leave recorded successfully.");
      setLeaveFormOpen(false);
      setLeaveReason("");
      fetchConsole();
    } finally {
      setSavingLeave(false);
    }
  }

  async function handleUpdateLeaveStatus(leaveId: number, status: "approved" | "rejected") {
    if (!activeStudentId) return;
    const res = await fetch(`/api/admin/students/${activeStudentId}/leaves`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leave_id: leaveId, status }),
    });
    if (res.ok) {
      toast.success(`Leave marked as ${status}.`);
      fetchConsole();
    }
  }

  const s360 = data?.student360;
  const feesTotalBilled = (s360?.fees ?? []).reduce((a, f) => a + Number(f.amount), 0);
  const feesTotalConcession = (s360?.fees ?? []).reduce(
    (a, f) => a + Number(f.concession_amount),
    0,
  );
  const feesTotalPaid = (s360?.fees ?? []).reduce((a, f) => a + Number(f.paid_amount), 0);
  const feesTotalDue = (s360?.fees ?? []).reduce((a, f) => a + Number(f.due_amount), 0);

  return (
    <div className="space-y-6">
      {/* 1. CONSOLE HERO HEADER & CASCADING FILTERS */}
      <section className="relative overflow-hidden rounded-3xl border border-blue-200/60 bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-950 p-6 text-white shadow-xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/30">
                <Grid2x2 className="h-4 w-4" />
              </span>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-300">
                Academic Operations Hub
              </p>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
              Classes & Sections Console
            </h1>
            <p className="mt-1 text-xs text-blue-200/80 sm:text-sm">
              Integrated roster manager, direct print issuance, and 360Â° student lifecycle records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/school-classes"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              <Building2 className="h-3.5 w-3.5 text-blue-300" />
              <span>Manage Classes</span>
            </Link>
            <Link
              href="/admin/class-sections"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              <Users className="h-3.5 w-3.5 text-indigo-300" />
              <span>Manage Sections</span>
            </Link>
            {data?.currentSection && (
              <Link
                href={`/print/section-cards/${data.currentSection.id}?autoprint=1`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-black text-slate-950 shadow-md transition hover:bg-amber-300"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Section Cards</span>
              </Link>
            )}
          </div>
        </div>

        {/* CASCADING SELECTION STRIP */}
        <div className="relative mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-blue-200">
              Academic Session
            </label>
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border-0 bg-white/95 px-3.5 py-2 text-xs font-bold text-slate-900 shadow-sm focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-white"
            >
              {(data?.sessions ?? []).map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name} {s.is_current ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-blue-200">
              1. Select Class <span className="text-amber-400">*</span>
            </label>
            <select
              value={classId}
              onChange={(e) => handleClassChange(e.target.value)}
              className="mt-1.5 w-full rounded-xl border-0 bg-white px-3.5 py-2 text-xs font-extrabold text-blue-950 shadow-sm focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-white"
            >
              <option value="">-- Choose Class --</option>
              {(data?.classes ?? []).map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-blue-200">
              2. Respective Section <span className="text-amber-400">*</span>
            </label>
            <select
              value={sectionId}
              disabled={!classId || (data?.sections ?? []).length === 0}
              onChange={(e) => setSectionId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border-0 bg-white px-3.5 py-2 text-xs font-extrabold text-blue-950 shadow-sm focus:ring-2 focus:ring-blue-400 disabled:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-white"
            >
              {(data?.sections ?? []).length === 0 ? (
                <option value="all">No Sections in Class</option>
              ) : (
                <>
                  <option value="all">
                    All Sections in {data?.currentClass?.name ?? "Class"}
                  </option>
                  {(data?.sections ?? []).map((sec) => (
                    <option key={sec.id} value={String(sec.id)}>
                      {sec.name} (Cap: {sec.capacity ?? "â€”"})
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-blue-200">
              Live Search Roster
            </label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, roll, admission..."
                className="w-full rounded-xl border-0 bg-white/95 pl-8 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 shadow-sm focus:ring-2 focus:ring-blue-400 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 2. KPI CHIPS */}
      {data?.currentClass && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Class & Section
            </span>
            <span className="mt-1 block text-base font-black text-blue-900 dark:text-blue-300">
              {data.currentClass.name}{" "}
              {data.currentSection ? `â€¢ ${data.currentSection.name}` : "(All)"}
            </span>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Enrolled Students
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-black text-slate-900 dark:text-white">
                {data.stats.totalStudents}
              </span>
              <span className="text-[11px] font-bold text-slate-500">Students</span>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Gender Ratio
            </span>
            <div className="mt-1 flex items-center gap-3 text-xs font-bold">
              <span className="text-blue-700 dark:text-blue-400">
                {data.stats.boysCount} Boys
              </span>
              <span className="text-pink-700 dark:text-pink-400">
                {data.stats.girlsCount} Girls
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Capacity & Occupancy
            </span>
            <div className="mt-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>
                  {data.stats.totalStudents} /{" "}
                  {data.stats.capacity > 0 ? data.stats.capacity : "â€”"}
                </span>
                <span className="text-blue-600">{data.stats.occupancyPercent}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${data.stats.occupancyPercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="col-span-2 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-1 dark:border-slate-800 dark:bg-slate-900">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Class Teacher
            </span>
            <span className="mt-1 block truncate text-xs font-bold text-slate-800 dark:text-slate-200">
              {data.stats.classTeacherName}
            </span>
          </div>
        </section>
      )}

      {/* 3. STUDENT ROSTER TABLE */}
      <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Enrolled Student Roster
            </h2>
            <Badge variant="blue">{data?.enrollments.length ?? 0} Records</Badge>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
          </div>
          <p className="text-xs text-slate-400">
            Click any student row or{" "}
            <span className="font-semibold text-blue-600">360Â° Profile</span> to inspect
            siblings, leaves, and fee history.
          </p>
        </div>

        {(data?.enrollments ?? []).length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-slate-800">
              <GraduationCap className="h-8 w-8" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
              No students found
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              No enrolled students matched this class, section, or search filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3.5">Roll</th>
                  <th className="px-6 py-3.5">Student Information</th>
                  <th className="px-6 py-3.5">Class & Section</th>
                  <th className="px-6 py-3.5">Father / Guardian</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions & Prints</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(data?.enrollments ?? []).map((enr) => {
                  const st = enr.students;
                  if (!st) return null;
                  const pUrl = photoUrl(st.photo_path);
                  return (
                    <tr
                      key={enr.id}
                      onClick={() => {
                        setActiveStudentId(st.id);
                        setActiveTab("overview");
                      }}
                      className="group cursor-pointer transition hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 font-mono text-xs font-black text-blue-900 group-hover:bg-blue-600 group-hover:text-white transition dark:bg-blue-950 dark:text-blue-300">
                          {enr.roll_no ?? "â€”"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {pUrl ? (
                            <img
                              src={pUrl}
                              alt={st.full_name}
                              className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-blue-100"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-xs font-black text-white shadow-sm">
                              {getInitials(st.full_name)}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 group-hover:text-blue-700 transition dark:text-white">
                                {st.full_name}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-2">
                              <span className="font-mono text-[10px] font-bold text-blue-700 dark:text-blue-400">
                                {st.admission_no ?? "â€”"}
                              </span>
                              <span className="text-slate-300">â€¢</span>
                              <span className="text-[10px] text-slate-500">
                                DOB: {formatDate(st.dob)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {enr.school_classes?.name ?? "â€”"}
                        </span>
                        <span className="block text-[10px] font-semibold text-slate-400">
                          {enr.class_sections?.name ?? "â€”"}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {st.families?.guardian_name ?? "â€”"}
                        </span>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                          <span className="font-mono">
                            {st.families?.guardian_mobile ?? "â€”"}
                          </span>
                          <span className="text-slate-300">â€¢</span>
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            FAM-{st.families?.family_number ?? "â€”"}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={statusVariant(st.status)} dot>
                          {st.status}
                        </Badge>
                      </td>

                      <td
                        className="px-6 py-4 whitespace-nowrap text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/print/id-card/${st.id}?autoprint=1`}
                            target="_blank"
                            className="inline-flex items-center gap-1 rounded-xl bg-blue-50 px-2.5 py-1.5 text-[11px] font-extrabold text-blue-700 transition hover:bg-blue-600 hover:text-white dark:bg-blue-950 dark:text-blue-300"
                          >
                            <IdCard className="h-3.5 w-3.5" />
                            <span>Card</span>
                          </Link>
                          <Link
                            href={`/print/marksheet/${st.id}?session_id=${sessionId}&autoprint=1`}
                            target="_blank"
                            className="inline-flex items-center gap-1 rounded-xl bg-indigo-50 px-2.5 py-1.5 text-[11px] font-extrabold text-indigo-700 transition hover:bg-indigo-600 hover:text-white dark:bg-indigo-950 dark:text-indigo-300"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>Marksheet</span>
                          </Link>
                          <Link
                            href={`/print/leaving-certificate/${st.id}?autoprint=1`}
                            target="_blank"
                            className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-2.5 py-1.5 text-[11px] font-extrabold text-amber-800 transition hover:bg-amber-500 hover:text-slate-950 dark:bg-amber-950 dark:text-amber-300"
                          >
                            <GraduationCap className="h-3.5 w-3.5" />
                            <span>SLC</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveStudentId(st.id);
                              setActiveTab("overview");
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-[11px] font-extrabold text-white transition hover:bg-blue-700 dark:bg-slate-700 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>360Â°</span>
                          </button>
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

      {/* 4. 360Â° STUDENT RECORD MODAL */}
      {s360 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm"
          onClick={() => setActiveStudentId(null)}
        >
          <div
            className="relative flex flex-col w-full max-w-4xl max-h-[92vh] rounded-3xl border border-blue-200/80 bg-white shadow-2xl overflow-hidden dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Banner */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 via-amber-300 to-amber-500 p-0.5 shadow-lg">
                    {photoUrl(s360.student.photo_path) ? (
                      <img
                        src={photoUrl(s360.student.photo_path)!}
                        alt={s360.student.full_name}
                        className="h-full w-full rounded-[14px] object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-900 text-lg font-black text-amber-400">
                        {getInitials(s360.student.full_name)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-black tracking-tight">
                        {s360.student.full_name}
                      </h2>
                      <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-emerald-300 ring-1 ring-emerald-400/30">
                        {s360.student.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-blue-200">
                      Admission No:{" "}
                      <strong className="font-mono text-white">
                        {s360.student.admission_no ?? "â€”"}
                      </strong>{" "}
                      â€¢ Roll No:{" "}
                      <strong className="font-mono text-white">
                        {s360.enrollment?.roll_no ?? "â€”"}
                      </strong>{" "}
                      â€¢ Class:{" "}
                      <strong className="text-amber-300">
                        {s360.enrollment?.school_classes?.name ?? "â€”"} (
                        {s360.enrollment?.class_sections?.name ?? "â€”"})
                      </strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveStudentId(null)}
                  className="rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300">
                  Direct Prints:
                </span>
                <Link
                  href={`/print/id-card/${s360.student.id}?autoprint=1`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600/80 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-600 transition"
                >
                  <IdCard className="h-3.5 w-3.5" />
                  <span>Print ID Card</span>
                </Link>
                <Link
                  href={`/print/marksheet/${s360.student.id}?session_id=${sessionId}&autoprint=1`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600/80 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-600 transition"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Print Marksheet</span>
                </Link>
                <Link
                  href={`/print/leaving-certificate/${s360.student.id}?autoprint=1`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300 transition"
                >
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span>Print Leaving Certificate</span>
                </Link>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex overflow-x-auto border-b border-blue-100 bg-slate-50 px-6 text-xs font-bold dark:border-slate-800 dark:bg-slate-800/50">
              {(
                [
                  { id: "overview", label: "Overview & Bio", icon: User },
                  {
                    id: "siblings",
                    label: `Siblings (${s360.siblings.length})`,
                    icon: Users,
                  },
                  {
                    id: "leaves",
                    label: `Leave Record (${s360.leaves.length})`,
                    icon: CalendarDays,
                  },
                  {
                    id: "fees",
                    label: `Fees Record (${s360.fees.length})`,
                    icon: Banknote,
                  },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-4 transition cursor-pointer ${
                    activeTab === id
                      ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeTab === "overview" && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5 dark:border-slate-800 dark:bg-slate-800/40">
                    <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-300">
                      <IdCard className="h-4 w-4 text-blue-600" />
                      <span>Personal & Enrollment Details</span>
                    </h3>
                    <div className="mt-4 grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400">
                          Gender
                        </span>
                        <span className="font-bold capitalize text-slate-900 dark:text-white">
                          {s360.student.gender}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400">
                          Date of Birth
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatDate(s360.student.dob, true)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400">
                          B-Form / CNIC
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {s360.student.b_form_no ?? "â€”"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400">
                          Admission Date
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatDate(s360.student.admission_date)}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="block text-[10px] uppercase font-bold text-slate-400">
                          Previous School Attended
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {s360.student.previous_school || "None (Direct Admission)"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5 dark:border-slate-800 dark:bg-slate-800/40">
                    <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-900 dark:text-blue-300">
                      <Home className="h-4 w-4 text-blue-600" />
                      <span>Family & Guardian Record</span>
                    </h3>
                    <div className="mt-4 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          Guardian Name
                        </span>
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {s360.student.families?.guardian_name ?? "â€”"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          Guardian Mobile
                        </span>
                        <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                          {s360.student.families?.guardian_mobile ?? "â€”"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          Guardian CNIC
                        </span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {s360.student.families?.guardian_cnic ?? "â€”"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          Family Registration ID
                        </span>
                        <span className="font-mono font-extrabold text-indigo-700 dark:text-indigo-300">
                          FAM-{s360.student.families?.family_number ?? "â€”"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400">
                          Residential Address
                        </span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {s360.student.families?.address || "Address on file"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "siblings" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        Family Siblings Network
                      </h3>
                      <p className="text-xs text-slate-500">
                        Other children under{" "}
                        <span className="font-mono font-bold text-indigo-600">
                          FAM-{s360.student.families?.family_number}
                        </span>
                      </p>
                    </div>
                    <Badge variant="blue">{s360.siblings.length} Sibling(s)</Badge>
                  </div>

                  {s360.siblings.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                      <Users className="mx-auto h-10 w-10 text-slate-400" />
                      <p className="mt-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                        No other siblings registered for this family.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {s360.siblings.map((sib) => {
                        const latestEnr = sib.student_enrollments[0];
                        return (
                          <div
                            key={sib.id}
                            className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white via-blue-50/20 to-slate-50 p-4 shadow-sm dark:border-slate-800 dark:from-slate-800/60 dark:to-slate-900"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xs font-black text-white">
                                  {getInitials(sib.full_name)}
                                </div>
                                <div>
                                  <h4 className="font-extrabold text-slate-900 dark:text-white">
                                    {sib.full_name}
                                  </h4>
                                  <p className="font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                    {sib.admission_no ?? "â€”"}
                                  </p>
                                </div>
                              </div>
                              <Badge variant="slate">{sib.gender}</Badge>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5 text-xs dark:border-slate-700">
                              <div>
                                <span className="block text-[10px] text-slate-400">
                                  Class & Section
                                </span>
                                <strong className="text-slate-800 dark:text-slate-200">
                                  {latestEnr?.school_classes?.name ?? "â€”"} (
                                  {latestEnr?.class_sections?.name ?? "â€”"})
                                </strong>
                              </div>
                              <div>
                                <span className="block text-[10px] text-slate-400">
                                  Roll No
                                </span>
                                <strong className="font-mono text-slate-800 dark:text-slate-200">
                                  {latestEnr?.roll_no ?? "â€”"}
                                </strong>
                              </div>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveStudentId(sib.id);
                                  setActiveTab("overview");
                                }}
                                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition cursor-pointer"
                              >
                                <span>Switch to Sibling Record</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "leaves" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        Student Leave History
                      </h3>
                      <p className="text-xs text-slate-500">
                        Total:{" "}
                        <strong>
                          {s360.leaves.reduce((a, l) => a + l.days_count, 0)} Day(s)
                        </strong>{" "}
                        recorded
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLeaveFormOpen((o) => !o)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-800 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Log Leave</span>
                    </button>
                  </div>

                  {leaveFormOpen && (
                    <form
                      onSubmit={handleCreateLeave}
                      className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 space-y-3 dark:border-slate-700 dark:bg-slate-800/60"
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label className="block text-[11px] font-bold mb-1">
                            Leave Type
                          </label>
                          <select
                            value={leaveType}
                            onChange={(e) => setLeaveType(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                          >
                            <option>Sick Leave</option>
                            <option>Casual Leave</option>
                            <option>Medical Leave</option>
                            <option>Family Event</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold mb-1">
                            Start Date
                          </label>
                          <input
                            type="date"
                            required
                            value={leaveStart}
                            onChange={(e) => setLeaveStart(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold mb-1">
                            End Date
                          </label>
                          <input
                            type="date"
                            required
                            value={leaveEnd}
                            onChange={(e) => setLeaveEnd(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                          />
                        </div>
                      </div>
                      <input
                        type="text"
                        value={leaveReason}
                        onChange={(e) => setLeaveReason(e.target.value)}
                        placeholder="Reason / remarks..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setLeaveFormOpen(false)}
                          className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingLeave}
                          className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
                        >
                          {savingLeave ? "Saving..." : "Save & Approve"}
                        </button>
                      </div>
                    </form>
                  )}

                  {s360.leaves.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
                      <p className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                        Clean Attendance Record
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-blue-100 bg-white dark:border-slate-800 dark:bg-slate-900">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
                          <tr>
                            <th className="px-4 py-3">Leave Type</th>
                            <th className="px-4 py-3">Date Range</th>
                            <th className="px-4 py-3">Days</th>
                            <th className="px-4 py-3">Reason</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {s360.leaves.map((l) => (
                            <tr key={l.id}>
                              <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                                {l.leave_type}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                                {formatDate(l.start_date)} â€” {formatDate(l.end_date)}
                              </td>
                              <td className="px-4 py-3 font-mono font-bold text-blue-700 dark:text-blue-400">
                                {l.days_count}d
                              </td>
                              <td className="px-4 py-3 max-w-xs truncate text-slate-600 dark:text-slate-300">
                                {l.reason ?? "â€”"}
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant={statusVariant(l.status)}>
                                  {l.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                {l.status === "pending" ? (
                                  <div className="inline-flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateLeaveStatus(l.id, "approved")
                                      }
                                      className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 cursor-pointer"
                                    >
                                      <Check className="h-3 w-3 inline" /> Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateLeaveStatus(l.id, "rejected")
                                      }
                                      className="rounded-lg bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-200 cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-400">
                                    {l.approved_by ?? "â€”"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "fees" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                        Student & Family Fee Ledger
                      </h3>
                      <p className="text-xs text-slate-500">
                        Account statement, sibling concessions, and bank challan history
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s360.latestFamilyChallanId && (
                        <Link
                          href={`/print/family-challan/${s360.latestFamilyChallanId}?autoprint=1`}
                          target="_blank"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-800"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Print Family 3-Part Slip</span>
                        </Link>
                      )}
                      <Link
                        href="/admin/fees-console"
                        className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <span>Fees Console</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-blue-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
                        Total Billed
                      </span>
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        {formatCurrency(feesTotalBilled)}
                      </span>
                    </div>
                    <div className="rounded-2xl border border-blue-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
                        Concession
                      </span>
                      <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                        {formatCurrency(feesTotalConcession)}
                      </span>
                    </div>
                    <div className="rounded-2xl border border-blue-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
                        Total Paid
                      </span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(feesTotalPaid)}
                      </span>
                    </div>
                    <div className="rounded-2xl border border-blue-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">
                        Outstanding
                      </span>
                      <span
                        className={`text-base font-black ${
                          feesTotalDue > 0 ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {formatCurrency(feesTotalDue)}
                      </span>
                    </div>
                  </div>

                  {s360.fees.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                      <Banknote className="mx-auto h-10 w-10 text-slate-400" />
                      <p className="mt-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                        No fee vouchers recorded yet.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-blue-100 bg-white dark:border-slate-800 dark:bg-slate-900">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
                          <tr>
                            <th className="px-4 py-3">Challan #</th>
                            <th className="px-4 py-3">Month / Type</th>
                            <th className="px-4 py-3">Gross</th>
                            <th className="px-4 py-3">Paid</th>
                            <th className="px-4 py-3">Balance</th>
                            <th className="px-4 py-3">Due Date</th>
                            <th className="px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {s360.fees.map((fee) => (
                            <tr key={fee.id}>
                              <td className="px-4 py-3 font-mono font-bold text-blue-900 dark:text-blue-300">
                                {fee.challan_no}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <strong className="text-slate-900 dark:text-white">
                                  {fee.billing_month}
                                </strong>
                                <span className="block text-[10px] text-slate-400">
                                  {fee.fee_type}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono">
                                {formatCurrency(fee.amount)}
                              </td>
                              <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(fee.paid_amount)}
                              </td>
                              <td
                                className={`px-4 py-3 font-mono font-bold ${
                                  fee.due_amount > 0 ? "text-rose-600" : "text-slate-400"
                                }`}
                              >
                                {formatCurrency(fee.due_amount)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                                {formatDate(fee.due_date)}
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant={statusVariant(fee.status)}>
                                  {fee.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-800/60">
              <span className="text-[11px] text-slate-400">
                SM Public School SIS â€¢ 360Â° Student Record
              </span>
              <button
                type="button"
                onClick={() => setActiveStudentId(null)}
                className="rounded-xl bg-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-white cursor-pointer"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

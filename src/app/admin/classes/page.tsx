"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  GraduationCap,
  Layers,
  Loader2,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { getInitials, photoUrl } from "@/lib/format";

interface SessionItem {
  id: number;
  name: string;
  is_current: boolean;
}

interface ClassCardItem {
  id: number;
  name: string;
  sort_order: number;
  totalStudents: number;
  boysCount: number;
  girlsCount: number;
  totalCapacity: number;
  occupancyPercent: number;
  sections: {
    id: number;
    name: string;
    capacity: number | null;
    classTeacher: string | null;
    count: number;
  }[];
  previewAvatars: {
    id: number;
    full_name: string;
    photo_path: string | null;
  }[];
}

interface OverviewPayload {
  sessions: SessionItem[];
  selectedSession: SessionItem | null;
  summary: {
    totalClasses: number;
    totalStudents: number;
    totalSections: number;
    activeClassesWithStudents: number;
  };
  classes: ClassCardItem[];
}

const ACCENTS = [
  {
    bar: "from-blue-600 to-indigo-600",
    badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300",
    ring: "hover:border-blue-400 hover:shadow-blue-900/10",
    back: "from-blue-700 via-blue-800 to-indigo-900",
  },
  {
    bar: "from-indigo-600 to-violet-600",
    badge: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300",
    ring: "hover:border-indigo-400 hover:shadow-indigo-900/10",
    back: "from-indigo-700 via-indigo-800 to-slate-900",
  },
  {
    bar: "from-sky-600 to-blue-600",
    badge: "bg-sky-50 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300",
    ring: "hover:border-sky-400 hover:shadow-sky-900/10",
    back: "from-sky-700 via-blue-800 to-slate-900",
  },
  {
    bar: "from-emerald-600 to-teal-600",
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
    ring: "hover:border-emerald-400 hover:shadow-emerald-900/10",
    back: "from-emerald-700 via-teal-800 to-slate-900",
  },
];

export default function ClassesCardsPage() {
  const router = useRouter();
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [flippingId, setFlippingId] = useState<number | null>(null);

  const loadClasses = useCallback(async () => {
    setLoading(true);
    try {
      const qs = sessionId ? `?sessionId=${sessionId}` : "";
      const res = await fetch(`/api/admin/classes-overview${qs}`);
      if (res.ok) {
        const json = (await res.json()) as OverviewPayload;
        setData(json);
        if (!sessionId && json.selectedSession) {
          setSessionId(String(json.selectedSession.id));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  function handleCardClick(cls: ClassCardItem) {
    if (flippingId !== null) return;
    setFlippingId(cls.id);
    window.setTimeout(() => {
      router.push(`/admin/students?classId=${cls.id}`);
    }, 420);
  }

  const filteredClasses = (data?.classes ?? []).filter((c) =>
    c.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* HERO & CONTROLS */}
      <section className="relative overflow-hidden rounded-3xl border border-blue-200/60 bg-gradient-to-br from-blue-950 via-indigo-950 to-slate-950 p-6 text-white shadow-xl sm:p-8">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
              Academic Overview
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
              School Classes
            </h1>
            <p className="mt-2 text-sm text-blue-100/85 sm:text-base">
              Click any class KPI card to flip directly into its student directory.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {(data?.sessions ?? []).map((s) => (
                <option key={s.id} value={String(s.id)} className="text-slate-900">
                  Session {s.name} {s.is_current ? "(Current)" : ""}
                </option>
              ))}
            </select>

            <Link
              href="/admin/students?new=1"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-extrabold text-slate-950 shadow-md transition hover:bg-amber-300"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add Student</span>
            </Link>
          </div>
        </div>

        {/* SUMMARY METRICS */}
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">
              Total Classes
            </p>
            <p className="mt-1 text-3xl font-black text-white">
              {data?.summary.totalClasses ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">
              Enrolled Students
            </p>
            <p className="mt-1 text-3xl font-black text-amber-300">
              {data?.summary.totalStudents ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">
              Active Sections
            </p>
            <p className="mt-1 text-3xl font-black text-emerald-300">
              {data?.summary.totalSections ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">
              Populated Classes
            </p>
            <p className="mt-1 text-3xl font-black text-sky-300">
              {data?.summary.activeClassesWithStudents ?? 0}
            </p>
          </div>
        </div>
      </section>

      {/* SEARCH BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter classes (e.g. Class 8, Prep)..."
            className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm font-medium text-slate-900 shadow-xs placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Showing <strong className="text-slate-900 dark:text-white">{filteredClasses.length}</strong>{" "}
          class(es)
        </p>
      </div>

      {/* 3D FLIPPABLE CLASS KPI CARDS GRID */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-blue-600">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-900">
          <Building2 className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-3 text-base font-bold text-slate-700 dark:text-slate-200">
            No classes match &ldquo;{search}&rdquo;
          </p>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredClasses.map((cls, index) => {
            const accent = ACCENTS[index % ACCENTS.length];
            const isFlipped = flippingId === cls.id;

            return (
              <div
                key={cls.id}
                role="button"
                tabIndex={0}
                onClick={() => handleCardClick(cls)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCardClick(cls);
                  }
                }}
                className="flip-perspective group h-[250px] cursor-pointer focus:outline-none"
              >
                <div
                  className={`flip-card-inner ${isFlipped ? "is-flipped" : ""}`}
                >
                  {/* FRONT FACE */}
                  <article
                    className={`flip-card-face absolute inset-0 flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 ${accent.ring}`}
                  >
                    <div
                      className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accent.bar}`}
                    />

                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-extrabold tracking-tight text-slate-950 group-hover:text-blue-700 transition dark:text-white dark:group-hover:text-blue-400">
                            {cls.name}
                          </h2>
                          <p className="mt-0.5 text-sm font-medium text-slate-500 dark:text-slate-400">
                            {cls.sections.length > 0
                              ? `${cls.sections.length} Section${cls.sections.length > 1 ? "s" : ""}`
                              : "No sections yet"}
                          </p>
                        </div>

                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accent.badge}`}
                        >
                          <GraduationCap className="h-5 w-5" />
                        </div>
                      </div>

                      {/* BIG READABLE KPI NUMBER */}
                      <div className="mt-4 flex items-end justify-between">
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-black tracking-tight text-slate-950 dark:text-white">
                            {cls.totalStudents}
                          </span>
                          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                            Student{cls.totalStudents === 1 ? "" : "s"}
                          </span>
                        </div>

                        {/* Avatar Stack */}
                        {cls.previewAvatars.length > 0 && (
                          <div className="flex -space-x-2">
                            {cls.previewAvatars.map((av) => {
                              const p = photoUrl(av.photo_path);
                              return p ? (
                                <img
                                  key={av.id}
                                  src={p}
                                  alt={av.full_name}
                                  className="h-8 w-8 rounded-full object-cover ring-2 ring-white dark:ring-slate-900"
                                />
                              ) : (
                                <div
                                  key={av.id}
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-extrabold text-blue-800 ring-2 ring-white dark:bg-blue-950 dark:text-blue-200 dark:ring-slate-900"
                                >
                                  {getInitials(av.full_name, 1)}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* BOYS / GIRLS + SECTIONS */}
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                          {cls.boysCount} Boys
                        </span>
                        <span className="rounded-lg bg-pink-50 px-2.5 py-1 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300">
                          {cls.girlsCount} Girls
                        </span>
                        {cls.sections.slice(0, 2).map((sec) => (
                          <span
                            key={sec.id}
                            className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {sec.name} ({sec.count})
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* FOOTER PROMPT */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-bold text-blue-700 dark:border-slate-800 dark:text-blue-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        <span>View Students</span>
                      </span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </article>

                  {/* BACK FACE (SHOWN DURING 3D FLIP) */}
                  <div
                    className={`flip-card-back absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-gradient-to-br ${accent.back} p-6 text-center text-white shadow-2xl`}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                      <Layers className="h-7 w-7 text-amber-300" />
                    </div>
                    <h3 className="mt-4 text-2xl font-black tracking-tight">
                      {cls.name}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-blue-100">
                      Opening {cls.totalStudents} Student Record
                      {cls.totalStudents === 1 ? "" : "s"}...
                    </p>
                    <Loader2 className="mt-4 h-5 w-5 animate-spin text-amber-300" />
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

import React from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedTeacher } from "@/lib/auth";
import {
  TeacherLogoutButton,
  TeacherPortalClientHooks,
} from "@/components/teacher/TeacherLogoutButton";

export const dynamic = "force-dynamic";

export default async function TeacherPortalPage() {
  const teacher = await getAuthenticatedTeacher();
  const mobileSetting = await prisma.settings.findUnique({
    where: { key: "teacher_portal_mobile_only" },
  });
  const mobileOnly = mobileSetting ? Boolean(mobileSetting.value) : true;

  const hdrs = await headers();
  const ua = hdrs.get("user-agent") ?? "";
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

  if (!teacher) {
    return (
      <main className="min-h-screen bg-blue-50 flex items-center justify-center px-5 py-10 text-slate-900">
        <section className="w-full max-w-md rounded-3xl border border-blue-100 bg-white p-8 text-center shadow-xl">
          <p className="text-xs font-extrabold uppercase tracking-widest text-blue-700">
            Teacher Portal
          </p>
          <h1 className="mt-3 text-2xl font-black text-blue-950">
            Use your invitation link
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Open the personal invitation link sent by the school administration on your
            registered phone to set up this device.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-blue-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-800 transition"
          >
            Return to Home
          </Link>
        </section>
      </main>
    );
  }

  if (mobileOnly && !isMobile) {
    return (
      <main className="min-h-screen bg-blue-50 flex items-center justify-center px-5 py-10 text-slate-900">
        <section className="w-full max-w-md rounded-3xl border border-blue-100 bg-white p-8 text-center shadow-xl">
          <p className="text-xs font-extrabold uppercase tracking-widest text-blue-700">
            Teacher Portal
          </p>
          <h1 className="mt-3 text-2xl font-black text-blue-950">
            Open this portal on your phone
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The school has enabled the mobile teacher experience for this portal. Open the
            same link on your registered phone.
          </p>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 pb-24 text-slate-900">
      <TeacherPortalClientHooks />
      <header className="bg-blue-950 px-5 pb-6 pt-8 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-200">
          Shabiran Mustafa Public School
        </p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">Welcome, {teacher.name}</h1>
            <p className="mt-1 text-sm text-blue-100">Teacher Portal</p>
          </div>
          <TeacherLogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-5 px-4 py-5">
        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black text-blue-950">Your Sections</h2>
          <div className="mt-4 space-y-3">
            {teacher.teacher_sections.length === 0 ? (
              <p className="text-sm text-slate-500">No sections have been assigned yet.</p>
            ) : (
              teacher.teacher_sections.map((assignment) => (
                <div
                  key={Number(assignment.id)}
                  className="rounded-xl border border-blue-100 bg-blue-50/30 p-4"
                >
                  <p className="font-bold text-slate-900">
                    {assignment.class_sections.school_classes.name} —{" "}
                    {assignment.class_sections.name}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-blue-700">
                    {assignment.is_class_teacher ? "Class Teacher" : "Section Assignment"}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black text-blue-950">Your Subjects</h2>
          <div className="mt-4 space-y-3">
            {teacher.teacher_subject_assignments.length === 0 ? (
              <p className="text-sm text-slate-500">No subjects have been assigned yet.</p>
            ) : (
              teacher.teacher_subject_assignments.map((assignment) => (
                <div
                  key={Number(assignment.id)}
                  className="rounded-xl border border-blue-100 bg-blue-50/30 p-4"
                >
                  <p className="font-bold text-slate-900">{assignment.subjects.name}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {assignment.class_sections.school_classes.name} —{" "}
                    {assignment.class_sections.name}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 border-t border-blue-100 bg-white px-4 py-3 shadow-lg"
        aria-label="Teacher portal navigation"
      >
        <div className="mx-auto grid max-w-xl grid-cols-3 text-center text-xs font-bold text-blue-800">
          <Link className="py-2" href="/t">
            Home
          </Link>
          <span className="py-2 text-slate-400">Attendance</span>
          <span className="py-2 text-slate-400">Marks</span>
        </div>
      </nav>
    </div>
  );
}

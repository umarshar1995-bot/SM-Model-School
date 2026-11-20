import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  GraduationCap,
  IdCard,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50/70 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/40 flex flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-6xl space-y-10">
        <section className="grid w-full overflow-hidden rounded-3xl border border-blue-100/80 bg-white shadow-2xl shadow-blue-950/10 dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Left Institutional Hero */}
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-950 via-indigo-950 to-slate-950 px-8 py-12 text-white sm:px-12 sm:py-16">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />

            <div className="relative">
              <div className="flex items-center gap-4">
                <img
                  src="/school-mark.svg"
                  alt="Shabeeran Mustafa Public School"
                  className="h-16 w-16 rounded-2xl shadow-lg ring-1 ring-white/15"
                />
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300 ring-1 ring-amber-400/30">
                    Hindyari • Sukkur
                  </span>
                </div>
              </div>

              <h1 className="mt-8 text-4xl font-black tracking-tight sm:text-5xl leading-[1.1]">
                Shabeeran Mustafa Public School
              </h1>

              <p className="mt-5 max-w-lg text-base leading-7 text-blue-100/85">
                A unified school information platform for academic rosters, 360° student records,
                family-centric fee challans with automated sibling concessions, identity cards,
                and mobile teacher operations.
              </p>

              <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  { icon: GraduationCap, label: "360° Student SIS" },
                  { icon: Banknote, label: "Family Fee Engine" },
                  { icon: IdCard, label: "ID Cards & Prints" },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2.5 rounded-xl bg-white/10 px-3.5 py-2.5 text-xs font-semibold text-blue-100 ring-1 ring-white/10 backdrop-blur-sm"
                  >
                    <Icon className="h-4 w-4 text-amber-300 shrink-0" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Portal Gateway */}
          <div className="flex flex-col justify-center px-8 py-12 sm:px-12">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-400">
              Digital Campus Workspace
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
              Open your school portal
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Sign in to the administration desk to manage sessions, classes, families, students,
              marksheets, and monthly fee billing—or launch the Teacher Mobile Portal.
            </p>

            <div className="mt-8 space-y-3">
              <Link
                href="/admin"
                className="group flex w-full items-center justify-between rounded-2xl bg-blue-700 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
              >
                <span className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-blue-200" />
                  <span>Administration Desk</span>
                </span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>

              <Link
                href="/t"
                className="group flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-sm font-bold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50/70 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:border-blue-500"
              >
                <span className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span>Teacher Mobile Portal</span>
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-blue-600" />
              </Link>
            </div>

            <div className="mt-8 flex items-center gap-2 border-t border-slate-100 pt-6 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Powered by Next.js App Router • Connected to SM_School PostgreSQL</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Smartphone,
  Sun,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/components/providers/ThemeProvider";
import { cn, getInitials } from "@/lib/format";

export interface ShellUser {
  id: number;
  name: string;
  email: string;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
}

interface Tab {
  label: string;
  href: string;
  adminOnly?: boolean;
  permission?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Tabs shown above the page for every route in this section. */
  tabs?: Tab[];
  /** Extra routes that belong to this section even if not shown as primary tabs. */
  extraRoutes?: string[];
}

/**
 * One sidebar entry per area. Related pages are merged into the same
 * entry and reached through the tab bar at the top of the page.
 */
const NAV: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  {
    label: "Classes",
    href: "/admin/classes",
    icon: LibraryBig,
    tabs: [
      { label: "All Classes", href: "/admin/classes" },
      { label: "Class Console", href: "/admin/classes-and-sections" },
      { label: "Manage Classes", href: "/admin/school-classes" },
      { label: "Sections", href: "/admin/class-sections" },
      { label: "Subjects", href: "/admin/subjects" },
      { label: "Subject Matrix", href: "/admin/subject-matrix" },
      { label: "Marksheet", href: "/admin/student-marksheet" },
      { label: "Sessions", href: "/admin/academic-sessions" },
    ],
  },
  {
    label: "Students",
    href: "/admin/students",
    icon: GraduationCap,
    tabs: [
      { label: "Students", href: "/admin/students" },
      { label: "Families", href: "/admin/families" },
      { label: "Enrollments", href: "/admin/enrollments" },
    ],
  },
  {
    label: "Fees",
    href: "/admin/fees-console",
    icon: Banknote,
    tabs: [
      { label: "Challans & Payments", href: "/admin/fees-console", permission: "ViewAny:Fee" },
      { label: "Fee Settings", href: "/admin/fee-settings", adminOnly: true },
      { label: "Fee Audit", href: "/admin/fee-audit", adminOnly: true },
    ],
    extraRoutes: ["/admin/fee-structures"],
  },
  {
    label: "Teachers",
    href: "/admin/teachers",
    icon: Users,
    tabs: [
      { label: "Teachers", href: "/admin/teachers" },
      { label: "Assignments", href: "/admin/teacher-sections" },
    ],
  },
  { label: "ID Cards", href: "/admin/card-templates", icon: IdCard },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

interface SearchResult {
  type: "student" | "family" | "teacher" | "challan";
  id: number;
  title: string;
  subtitle: string;
  href: string;
}

function matches(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/");
}

export function AdminShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // The nav entry that owns the current page (by its own href, tabs, or extraRoutes).
  const activeItem = NAV.find((item) =>
    item.tabs
      ? item.tabs.some((t) => matches(pathname, t.href)) ||
        (item.extraRoutes?.some((r) => matches(pathname, r)) ?? false)
      : matches(pathname, item.href),
  );
  const activeTabs = activeItem?.tabs?.filter((tab) => {
    if (tab.adminOnly) return user.isSuperAdmin;
    if (tab.permission) {
      return user.isSuperAdmin || user.permissions.includes(tab.permission);
    }
    return true;
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!searchOpen) {
      setSearchQuery("");
      setSearchResults([]);
      return;
    }
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results ?? []);
        }
      } catch {
        // ignore transient search errors
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [searchQuery, searchOpen]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  }

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between border-b border-slate-100 px-3 dark:border-slate-800">
        <Link href="/admin" className="flex items-center gap-2.5 overflow-hidden">
          <img
            src="/school-mark.svg"
            alt="SM Public School"
            className="h-8 w-8 shrink-0 rounded-lg"
          />
          {!collapsed && (
            <p className="truncate text-sm font-black tracking-tight text-blue-950 dark:text-white">
              SM Public School
            </p>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2.5">
        {NAV.map((item) => {
          const active = activeItem?.href === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
                active
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                collapsed && "justify-center px-2",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-blue-600 dark:bg-blue-400" />
              )}
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  active ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500",
                )}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-2.5 dark:border-slate-800">
        <Link
          href="/t"
          target="_blank"
          title="Teacher Portal"
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-slate-800",
            collapsed && "justify-center px-2",
          )}
        >
          <Smartphone className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Teacher Portal</span>}
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200/80 bg-white transition-all duration-200 dark:border-slate-800 dark:bg-slate-900 lg:flex",
          collapsed ? "w-[4.25rem]" : "w-56",
        )}
      >
        {SidebarContent}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="h-full w-64 bg-white shadow-2xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/85 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-1.5 text-xs font-medium text-slate-500 transition hover:border-blue-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400 sm:w-72 cursor-pointer"
            >
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <span className="flex-1 truncate text-left">Search students, families, challans...</span>
              <kbd className="hidden rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 sm:inline-block">
                Ctrl K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-amber-300 dark:hover:bg-slate-700 cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1 dark:border-slate-700 dark:bg-slate-800/70 sm:flex">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-tr from-blue-700 to-indigo-600 text-[10px] font-black text-white">
                {getInitials(user.name)}
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">{user.name}</p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/40 cursor-pointer"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Sign out</span>
            </button>
          </div>
        </header>

        {activeTabs && (
          <div className="border-b border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
            <nav className="mx-auto flex max-w-[1600px] gap-1.5 overflow-x-auto px-4 sm:px-6 lg:px-8" aria-label="Section">
              {activeTabs.map((tab) => {
                const active = matches(pathname, tab.href);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      "whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition",
                      active
                        ? "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300"
                        : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
                    )}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1600px] flex-1 animate-page-in p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 p-4 pt-20 backdrop-blur-xs"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
              <Search className="h-4 w-4 text-blue-600" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Student name, admission #, FAM-ID, teacher, or challan..."
                className="flex-1 bg-transparent text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none dark:text-white"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto p-2">
              {searchQuery.trim().length < 2 ? (
                <div className="px-4 py-8 text-center text-xs text-slate-400">
                  Type at least 2 characters to search.
                </div>
              ) : searching ? (
                <div className="px-4 py-8 text-center text-xs text-slate-500">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-slate-400">
                  No results for &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : (
                <ul className="space-y-1">
                  {searchResults.map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      <Link
                        href={item.href}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs transition hover:bg-blue-50 dark:hover:bg-blue-950/40"
                      >
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{item.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {item.type}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

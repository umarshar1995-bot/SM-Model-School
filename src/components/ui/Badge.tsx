import React from "react";
import { cn } from "@/lib/format";

type BadgeVariant =
  | "blue"
  | "indigo"
  | "emerald"
  | "amber"
  | "rose"
  | "slate"
  | "sky";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-400/20",
  indigo:
    "bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-950/60 dark:text-indigo-300 dark:ring-indigo-400/20",
  emerald:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/20",
  amber:
    "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-400/20",
  rose: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-400/20",
  slate:
    "bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600/30",
  sky: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-400/20",
};

export function Badge({
  children,
  variant = "slate",
  dot = false,
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            variant === "emerald" && "bg-emerald-500",
            variant === "amber" && "bg-amber-500",
            variant === "rose" && "bg-rose-500",
            variant === "blue" && "bg-blue-500",
            variant === "indigo" && "bg-indigo-500",
            variant === "sky" && "bg-sky-500",
            variant === "slate" && "bg-slate-400",
          )}
        />
      )}
      {children}
    </span>
  );
}

export function statusVariant(status?: string | null): BadgeVariant {
  switch ((status ?? "").toLowerCase()) {
    case "active":
    case "paid":
    case "approved":
      return "emerald";
    case "partial":
    case "pending":
    case "promoted":
      return "amber";
    case "unpaid":
    case "overdue":
    case "left":
    case "struck_off":
    case "rejected":
    case "inactive":
      return "rose";
    case "passed_out":
    case "graduated":
      return "indigo";
    default:
      return "slate";
  }
}

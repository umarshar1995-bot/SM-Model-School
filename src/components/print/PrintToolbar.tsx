"use client";

import React, { useEffect } from "react";
import { ArrowLeft, Printer } from "lucide-react";

interface PrintToolbarProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  autoprint?: boolean;
  maxWidthClass?: string;
  badge?: React.ReactNode;
}

export function PrintToolbar({
  title,
  subtitle,
  actionLabel = "Print",
  autoprint = false,
  maxWidthClass = "max-w-[900px]",
  badge,
}: PrintToolbarProps) {
  useEffect(() => {
    if (!autoprint) return;
    const timer = window.setTimeout(() => {
      window.print();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [autoprint]);

  return (
    <div
      className={`no-print ${maxWidthClass} w-full mx-auto mb-5 flex flex-wrap items-center justify-between gap-3 bg-white px-5 py-3.5 rounded-2xl shadow-sm border border-slate-200`}
    >
      <div className="flex items-center gap-3">
        {badge ? (
          badge
        ) : (
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-blue-100 text-blue-700">
            <Printer className="w-4 h-4" />
          </span>
        )}
        <div>
          <h1 className="text-sm font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xl shadow-md transition cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>{actionLabel}</span>
        </button>
      </div>
    </div>
  );
}

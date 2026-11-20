"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";

export interface ImportClassOption {
  id: number;
  name: string;
}

export interface ImportSectionOption {
  id: number;
  name: string;
  class_id: number;
}

interface ValidatedRow {
  rowNumber: number;
  status: "valid" | "warning" | "error";
  errors: string[];
  warnings: string[];
  data: {
    full_name: string;
    father_name: string;
    guardian_mobile: string | null;
    class_name: string;
    section_name: string;
    roll_no: string | null;
    gender: string;
    dob: string | null;
    admission_no: string | null;
  };
}

interface ValidationReport {
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  classesBreakdown: { className: string; count: number }[];
  rows: ValidatedRow[];
}

interface ExcelImportModalProps {
  open: boolean;
  onClose: () => void;
  classes: ImportClassOption[];
  sections: ImportSectionOption[];
  defaultClassId?: string;
  defaultSectionId?: string;
  onImported: () => void;
}

export function ExcelImportModal({
  open,
  onClose,
  classes,
  sections,
  defaultClassId = "",
  defaultSectionId = "",
  onImported,
}: ExcelImportModalProps) {
  const [targetClassId, setTargetClassId] = useState(defaultClassId);
  const [targetSectionId, setTargetSectionId] = useState(defaultSectionId);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "errors">("all");
  const [skipInvalid, setSkipInvalid] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTargetClassId(defaultClassId);
      setTargetSectionId(defaultSectionId);
      setSelectedFile(null);
      setReport(null);
      setFilterMode("all");
      setSkipInvalid(true);
    }
  }, [open, defaultClassId, defaultSectionId]);

  const filteredSections = sections.filter(
    (s) => targetClassId && String(s.class_id) === targetClassId,
  );

  const activeClassObj = classes.find((c) => String(c.id) === targetClassId) ?? null;

  async function runValidation(file: File, clsId: string, secId: string) {
    setValidating(true);
    setReport(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", "validate");
      if (clsId) fd.append("targetClassId", clsId);
      if (secId) fd.append("targetSectionId", secId);

      const res = await fetch("/api/admin/students/import", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Could not validate Excel file.");
        return;
      }
      setReport(json as ValidationReport);
    } finally {
      setValidating(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    runValidation(file, targetClassId, targetSectionId);
    e.target.value = "";
  }

  function handleClassChange(nextClassId: string) {
    setTargetClassId(nextClassId);
    const firstSec = sections.find((s) => String(s.class_id) === nextClassId);
    const nextSecId = firstSec ? String(firstSec.id) : "";
    setTargetSectionId(nextSecId);
    if (selectedFile) {
      runValidation(selectedFile, nextClassId, nextSecId);
    }
  }

  function handleSectionChange(nextSecId: string) {
    setTargetSectionId(nextSecId);
    if (selectedFile) {
      runValidation(selectedFile, targetClassId, nextSecId);
    }
  }

  async function handleCommit() {
    if (!selectedFile || !report || report.validCount === 0) return;
    if (!skipInvalid && report.errorCount > 0) {
      toast.error("Fix validation errors or enable skipping invalid rows.");
      return;
    }

    setCommitting(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("mode", "commit");
      fd.append("skipInvalid", skipInvalid ? "true" : "false");
      if (targetClassId) fd.append("targetClassId", targetClassId);
      if (targetSectionId) fd.append("targetSectionId", targetSectionId);

      const res = await fetch("/api/admin/students/import", {
        method: "POST",
        body: fd,
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Import failed.");
        return;
      }

      toast.success(
        `Imported ${out.imported} student(s) (${out.familiesCreated} new families)${out.skipped ? ` • ${out.skipped} invalid skipped` : ""}.`,
      );
      onImported();
      onClose();
    } finally {
      setCommitting(false);
    }
  }

  const templateUrl = targetClassId
    ? `/api/admin/students/template?classId=${targetClassId}`
    : "/api/admin/students/template";

  const visibleRows =
    report?.rows.filter((r) =>
      filterMode === "errors" ? r.status === "error" || r.status === "warning" : true,
    ) ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        activeClassObj
          ? `Import Students to ${activeClassObj.name} (Excel)`
          : "Import Students via Excel (.xlsx / .csv)"
      }
      subtitle="Validated bulk import supporting every school class (Prep through Class 12) with automatic family linking & class enrollment."
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-5 text-sm">
        {/* Step 1: Class Target & Template Download */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 min-w-64">
              <div>
                <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Target Class
                </label>
                <select
                  value={targetClassId}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  <option value="">All Classes (Read class_name from Excel)</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={String(cls.id)}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Default Section
                </label>
                <select
                  value={targetSectionId}
                  disabled={!targetClassId}
                  onChange={(e) => handleSectionChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  <option value="">
                    {targetClassId ? "Auto (Section A / Excel)" : "Read from Excel (or Section A)"}
                  </option>
                  {filteredSections.map((sec) => (
                    <option key={sec.id} value={String(sec.id)}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <a
              href={templateUrl}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-extrabold text-blue-700 shadow-xs transition hover:bg-blue-700 hover:text-white dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"
            >
              <Download className="h-4 w-4" />
              <span>
                Download {activeClassObj ? `${activeClassObj.name} ` : ""}Template (.xlsx)
              </span>
            </a>
          </div>

          <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-400">
            Template includes a <strong>Valid Classes &amp; Rules</strong> sheet covering all {classes.length} classes.
            Required columns: <code className="font-mono font-bold">full_name</code>,{" "}
            <code className="font-mono font-bold">father_name</code>,{" "}
            <code className="font-mono font-bold">gender</code>,{" "}
            <code className="font-mono font-bold">dob</code>
            {!targetClassId && (
              <>
                , and <code className="font-mono font-bold">class_name</code>
              </>
            )}
            .
          </p>
        </div>

        {/* Step 2: File Picker */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            disabled={validating || committing}
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-6 py-7 text-center transition hover:border-blue-500 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-blue-500 cursor-pointer"
          >
            {validating ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="font-bold text-blue-800 dark:text-blue-300">
                  Validating spreadsheet rows, dates, CNICs, roll numbers &amp; classes...
                </p>
              </>
            ) : selectedFile ? (
              <>
                <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                <p className="font-extrabold text-slate-900 dark:text-white">
                  {selectedFile.name}{" "}
                  <span className="font-normal text-slate-500">
                    ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </p>
                <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                  Click to choose a different file
                </span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-blue-600" />
                <p className="text-base font-extrabold text-slate-900 dark:text-white">
                  Select Excel (.xlsx / .xls) or CSV File to Validate
                </p>
                <p className="text-xs text-slate-500">
                  Every row is validated before anything is written to the database.
                </p>
              </>
            )}
          </button>
        </div>

        {/* Step 3: Live Validation Preview */}
        {report && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
                <span className="text-xs font-bold uppercase text-slate-400">Total Rows</span>
                <p className="mt-0.5 text-2xl font-black text-slate-900 dark:text-white">
                  {report.totalRows}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <span className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
                  Valid &amp; Ready
                </span>
                <p className="mt-0.5 text-2xl font-black text-emerald-700 dark:text-emerald-300">
                  {report.validCount}
                </p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/30">
                <span className="text-xs font-bold uppercase text-amber-700 dark:text-amber-400">
                  Warnings
                </span>
                <p className="mt-0.5 text-2xl font-black text-amber-700 dark:text-amber-300">
                  {report.warningCount}
                </p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 dark:border-rose-900/50 dark:bg-rose-950/30">
                <span className="text-xs font-bold uppercase text-rose-700 dark:text-rose-400">
                  Errors (Blocked)
                </span>
                <p className="mt-0.5 text-2xl font-black text-rose-700 dark:text-rose-300">
                  {report.errorCount}
                </p>
              </div>
            </div>

            {report.classesBreakdown.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold uppercase text-slate-500">
                  Class Enrollment Breakdown:
                </span>
                {report.classesBreakdown.map((item) => (
                  <span
                    key={item.className}
                    className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800 dark:bg-blue-950/60 dark:text-blue-200"
                  >
                    {item.className}: {item.count}
                  </span>
                ))}
              </div>
            )}

            {/* Preview Filter & Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Validation Preview ({visibleRows.length} rows shown)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold cursor-pointer ${
                      filterMode === "all"
                        ? "bg-blue-700 text-white"
                        : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                    }`}
                  >
                    All ({report.totalRows})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("errors")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold cursor-pointer ${
                      filterMode === "errors"
                        ? "bg-rose-600 text-white"
                        : "bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                    }`}
                  >
                    Issues ({report.errorCount + report.warningCount})
                  </button>
                </div>
              </div>

              <div className="max-h-72 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white text-[11px] font-extrabold uppercase text-slate-500 shadow-xs dark:bg-slate-900">
                    <tr>
                      <th className="px-3 py-2.5">Row</th>
                      <th className="px-3 py-2.5">Student &amp; Father</th>
                      <th className="px-3 py-2.5">Class / Sec / Roll</th>
                      <th className="px-3 py-2.5">Gender &amp; DOB</th>
                      <th className="px-3 py-2.5">Validation Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleRows.slice(0, 200).map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={
                          row.status === "error"
                            ? "bg-rose-50/50 dark:bg-rose-950/20"
                            : row.status === "warning"
                              ? "bg-amber-50/40 dark:bg-amber-950/15"
                              : ""
                        }
                      >
                        <td className="px-3 py-2.5 font-mono font-bold text-slate-500">
                          #{row.rowNumber}
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-bold text-slate-900 dark:text-white">
                            {row.data.full_name || "—"}
                          </p>
                          <p className="text-slate-500">
                            Father: {row.data.father_name || "—"}
                            {row.data.guardian_mobile ? ` · ${row.data.guardian_mobile}` : ""}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-semibold">
                          {row.data.class_name || "—"} ({row.data.section_name})
                          {row.data.roll_no ? ` · R#${row.data.roll_no}` : ""}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap capitalize">
                          {row.data.gender || "—"} · {row.data.dob || "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {row.status === "valid" && (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Valid
                            </span>
                          )}
                          {row.errors.map((err) => (
                            <p
                              key={err}
                              className="flex items-start gap-1 font-semibold text-rose-700 dark:text-rose-400"
                            >
                              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>{err}</span>
                            </p>
                          ))}
                          {row.warnings.map((warn) => (
                            <p
                              key={warn}
                              className="flex items-start gap-1 font-medium text-amber-700 dark:text-amber-400"
                            >
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>{warn}</span>
                            </p>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Footer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div>
            {report && report.errorCount > 0 && report.validCount > 0 && (
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipInvalid}
                  onChange={(e) => setSkipInvalid(e.target.checked)}
                  className="rounded border-slate-300 text-blue-700"
                />
                <span>
                  Skip {report.errorCount} invalid row(s) and import {report.validCount} valid student(s)
                </span>
              </label>
            )}
            {report && report.errorCount === 0 && (
              <Badge variant="emerald">All {report.validCount} rows passed validation</Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={committing}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <X className="h-4 w-4" />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              disabled={
                !report ||
                report.validCount === 0 ||
                (!skipInvalid && report.errorCount > 0) ||
                committing
              }
              onClick={handleCommit}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              {committing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span>
                {committing
                  ? "Importing..."
                  : report
                    ? `Confirm & Import ${report.validCount} Student${report.validCount === 1 ? "" : "s"}`
                    : "Confirm & Import"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

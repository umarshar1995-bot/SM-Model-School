"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Home,
  IdCard,
  Layers,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Badge, statusVariant } from "@/components/ui/Badge";
import {
  formatDate,
  formatDateInput,
  getInitials,
  photoUrl,
} from "@/lib/format";

interface StudentRow {
  id: number;
  family_id: number;
  admission_no: string | null;
  full_name: string;
  gender: "male" | "female" | "other";
  dob: string;
  b_form_no: string | null;
  photo_path: string | null;
  previous_school: string | null;
  admission_date: string;
  status: "active" | "left" | "struck_off" | "passed_out";
  families: {
    id: number;
    family_number: number;
    guardian_name: string;
    guardian_mobile: string | null;
  } | null;
  student_enrollments: {
    roll_no: string | null;
    school_classes: { id: number; name: string } | null;
    class_sections: { id: number; name: string } | null;
  }[];
}

interface FamilyOption {
  id: number;
  family_number: number;
  guardian_name: string;
  guardian_mobile: string | null;
}

interface ClassOption {
  id: number;
  name: string;
}

interface SectionOption {
  id: number;
  name: string;
  class_id: number;
}

interface SessionOption {
  id: number;
  name: string;
}

interface RecentlyAddedStudent {
  id: number;
  full_name: string;
  admission_no: string | null;
  enrolled: boolean;
}

export default function StudentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialClassId = searchParams.get("classId") ?? "";
  const initialSectionId = searchParams.get("sectionId") ?? "";

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [families, setFamilies] = useState<FamilyOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionOption | null>(null);

  const [classFilter, setClassFilter] = useState(initialClassId);
  const [sectionFilter, setSectionFilter] = useState(initialSectionId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [trashed, setTrashed] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [loading, setLoading] = useState(true);

  // Per-card download popover
  const [openDownloadId, setOpenDownloadId] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Batch rapid-entry helpers (modal stays open on Add until closed)
  const [keepBatchContext, setKeepBatchContext] = useState(true);
  const [enrollNow, setEnrollNow] = useState(false);
  const [addedInSession, setAddedInSession] = useState<RecentlyAddedStudent[]>([]);

  // Inline quick family creation inside Add Student modal
  const [quickFamilyOpen, setQuickFamilyOpen] = useState(false);
  const [savingFamily, setSavingFamily] = useState(false);
  const [quickFamily, setQuickFamily] = useState({
    guardian_name: "",
    guardian_mobile: "",
    guardian_cnic: "",
    address: "",
  });

  const importInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fullNameInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    full_name: "",
    gender: "male" as "male" | "female" | "other",
    dob: "",
    b_form_no: "",
    photo_path: "",
    family_id: "",
    admission_no: "",
    admission_date: new Date().toISOString().slice(0, 10),
    previous_school: "",
    status: "active" as "active" | "left" | "struck_off" | "passed_out",
    class_id: "",
    section_id: "",
    roll_no: "",
  });

  useEffect(() => {
    setClassFilter(searchParams.get("classId") ?? "");
    setSectionFilter(searchParams.get("sectionId") ?? "");
  }, [searchParams]);

  // Close download dropdown when clicking outside
  useEffect(() => {
    if (openDownloadId === null) return;
    const close = () => setOpenDownloadId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [openDownloadId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("q", search.trim());
      if (statusFilter) qs.set("status", statusFilter);
      if (genderFilter) qs.set("gender", genderFilter);
      if (classFilter) qs.set("classId", classFilter);
      if (sectionFilter) qs.set("sectionId", sectionFilter);
      if (trashed) qs.set("trashed", "1");

      const res = await fetch(`/api/admin/students?${qs.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setStudents(json.students ?? []);
        setFamilies(json.families ?? []);
        setClasses(json.classes ?? []);
        setSections(json.sections ?? []);
        setCurrentSession(json.currentSession ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, genderFilter, classFilter, sectionFilter, trashed]);

  useEffect(() => {
    const t = window.setTimeout(loadData, 180);
    return () => window.clearTimeout(t);
  }, [loadData]);

  useEffect(() => {
    if (searchParams.get("new") === "1" && families.length > 0 && !modalOpen && !editing) {
      openCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, families.length]);

  const activeClassObj = classes.find((c) => String(c.id) === classFilter) ?? null;
  const classSectionsForFilter = sections.filter(
    (s) => classFilter && String(s.class_id) === classFilter,
  );

  function selectClassFilter(nextClassId: string) {
    setClassFilter(nextClassId);
    setSectionFilter("");
    const url = nextClassId ? `/admin/students?classId=${nextClassId}` : "/admin/students";
    router.replace(url);
  }

  function openCreate() {
    const targetClass =
      (classFilter ? classes.find((c) => String(c.id) === classFilter) : null) ??
      classes[0];
    const targetSec =
      (sectionFilter
        ? sections.find((s) => String(s.id) === sectionFilter)
        : null) ??
      sections.find((s) => targetClass && s.class_id === targetClass.id);

    setEditing(null);
    setAddedInSession([]);
    setQuickFamilyOpen(false);
    setEnrollNow(Boolean(currentSession && targetClass && targetSec));
    setForm({
      full_name: "",
      gender: "male",
      dob: "",
      b_form_no: "",
      photo_path: "",
      family_id: families[0] ? String(families[0].id) : "",
      admission_no: "",
      admission_date: new Date().toISOString().slice(0, 10),
      previous_school: "",
      status: "active",
      class_id: targetClass ? String(targetClass.id) : "",
      section_id: targetSec ? String(targetSec.id) : "",
      roll_no: "",
    });
    setModalOpen(true);
    window.setTimeout(() => fullNameInputRef.current?.focus(), 60);
  }

  function openEdit(s: StudentRow) {
    setEditing(s);
    setQuickFamilyOpen(false);
    setEnrollNow(false);
    setForm({
      full_name: s.full_name,
      gender: s.gender,
      dob: formatDateInput(s.dob),
      b_form_no: s.b_form_no ?? "",
      photo_path: s.photo_path ?? "",
      family_id: String(s.family_id),
      admission_no: s.admission_no ?? "",
      admission_date: formatDateInput(s.admission_date),
      previous_school: s.previous_school ?? "",
      status: s.status,
      class_id: "",
      section_id: "",
      roll_no: "",
    });
    setModalOpen(true);
  }

  function handleCloseModal() {
    setModalOpen(false);
    setQuickFamilyOpen(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "students");
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Photo upload failed.");
        return;
      }
      setForm((prev) => ({ ...prev, photo_path: out.path }));
      toast.success("Photo uploaded.");
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  }

  async function handleQuickFamilyCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!quickFamily.guardian_name.trim()) {
      toast.error("Guardian name is required.");
      return;
    }
    setSavingFamily(true);
    try {
      const res = await fetch("/api/admin/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardian_name: quickFamily.guardian_name.trim(),
          guardian_mobile: quickFamily.guardian_mobile.trim() || null,
          guardian_cnic: quickFamily.guardian_cnic.trim() || null,
          address: quickFamily.address.trim() || null,
          is_active: true,
        }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Failed to register family.");
        return;
      }
      const created: FamilyOption = {
        id: out.family.id,
        family_number: out.family.family_number,
        guardian_name: out.family.guardian_name,
        guardian_mobile: out.family.guardian_mobile,
      };
      setFamilies((prev) => [created, ...prev]);
      setForm((prev) => ({ ...prev, family_id: String(created.id) }));
      setQuickFamily({
        guardian_name: "",
        guardian_mobile: "",
        guardian_cnic: "",
        address: "",
      });
      setQuickFamilyOpen(false);
      toast.success(`Registered FAM-${created.family_number} (${created.guardian_name})`);
    } finally {
      setSavingFamily(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.family_id) {
      toast.error("Please select or register a family.");
      return;
    }
    if (!editing && enrollNow && (!form.class_id || !form.section_id)) {
      toast.error(
        "Select both a Class and Section to enroll immediately, or turn off instant enrollment.",
      );
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...(editing ? { id: editing.id } : {}),
        full_name: form.full_name,
        gender: form.gender,
        dob: form.dob,
        b_form_no: form.b_form_no || null,
        photo_path: form.photo_path || null,
        family_id: form.family_id,
        admission_no: form.admission_no || null,
        admission_date: form.admission_date,
        previous_school: form.previous_school || null,
        status: form.status,
      };

      if (!editing && enrollNow && form.class_id && form.section_id) {
        payload.enrollment = {
          class_id: form.class_id,
          section_id: form.section_id,
          roll_no: form.roll_no || null,
        };
      }

      const res = await fetch("/api/admin/students", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Failed to save student.");
        return;
      }

      if (editing) {
        toast.success("Student updated.");
        setModalOpen(false);
        loadData();
        return;
      }

      const savedStudent = out.student;
      const nextRoll =
        keepBatchContext && /^\d+$/.test(form.roll_no.trim())
          ? String(Number(form.roll_no.trim()) + 1).padStart(
              form.roll_no.trim().length,
              "0",
            )
          : "";

      setAddedInSession((prev) => [
        {
          id: savedStudent.id,
          full_name: savedStudent.full_name,
          admission_no: savedStudent.admission_no,
          enrolled: Boolean(out.enrolled),
        },
        ...prev,
      ]);

      toast.success(
        `${savedStudent.full_name} (${savedStudent.admission_no ?? "Admitted"})${out.enrolled ? " — enrolled" : ""}. Ready for next student!`,
      );

      setForm((prev) => ({
        full_name: "",
        gender: keepBatchContext ? prev.gender : "male",
        dob: "",
        b_form_no: "",
        photo_path: "",
        family_id: keepBatchContext
          ? prev.family_id
          : families[0]
            ? String(families[0].id)
            : "",
        admission_no: "",
        admission_date: prev.admission_date,
        previous_school: "",
        status: "active",
        class_id: prev.class_id,
        section_id: prev.section_id,
        roll_no: nextRoll,
      }));

      loadData();
      window.setTimeout(() => fullNameInputRef.current?.focus(), 40);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(
    student: StudentRow,
    mode: "soft" | "restore" | "force",
  ) {
    if (mode === "soft" && !confirm(`Move ${student.full_name} to trash?`)) return;
    if (mode === "force" && !confirm(`Permanently delete ${student.full_name}?`)) return;
    const res = await fetch(`/api/admin/students?id=${student.id}&mode=${mode}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(
        mode === "restore"
          ? `${student.full_name} restored.`
          : `${student.full_name} removed.`,
      );
      loadData();
    }
  }

  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/students/import", {
      method: "POST",
      body: fd,
    });
    const out = await res.json();
    e.target.value = "";
    if (!res.ok) {
      toast.error(out.error || "Import failed.");
      return;
    }
    toast.success(
      `Imported ${out.imported} student(s)${out.skipped ? ` (${out.skipped} skipped)` : ""}.`,
    );
    loadData();
  }

  const filteredModalSections = sections.filter(
    (sec) => String(sec.class_id) === form.class_id,
  );

  const exportUrl = classFilter
    ? `/api/admin/students/export?classId=${classFilter}`
    : "/api/admin/students/export";

  return (
    <div className="space-y-6">
      {/* ACTIVE CLASS CONTEXT BANNER (when opened from Classes KPI Card) */}
      {activeClassObj ? (
        <section className="relative overflow-hidden rounded-3xl border border-blue-200/70 bg-gradient-to-br from-blue-950 via-indigo-950 to-slate-950 p-6 text-white shadow-xl sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <Link
                href="/admin/classes"
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 text-sm font-semibold text-blue-100 transition hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to All Classes</span>
              </Link>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                  {activeClassObj.name}
                </h1>
                <span className="rounded-full bg-amber-400/20 px-3.5 py-1 text-sm font-bold text-amber-300 ring-1 ring-amber-400/30">
                  {students.length} Student{students.length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-sm text-blue-200/85">
                Showing enrolled students in {activeClassObj.name}. Filter by section, edit,
                download records, or admit new students directly into this class.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href={exportUrl}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                <Download className="h-4 w-4" />
                <span>Download Class Excel</span>
              </a>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-extrabold text-slate-950 shadow-md transition hover:bg-amber-300 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>Add to {activeClassObj.name}</span>
              </button>
            </div>
          </div>

          {/* SECTION FILTER PILLS */}
          {classSectionsForFilter.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setSectionFilter("")}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition cursor-pointer ${
                  sectionFilter === ""
                    ? "bg-white text-blue-950 shadow-sm"
                    : "bg-white/10 text-blue-100 hover:bg-white/20"
                }`}
              >
                All Sections
              </button>
              {classSectionsForFilter.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setSectionFilter(String(sec.id))}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition cursor-pointer ${
                    sectionFilter === String(sec.id)
                      ? "bg-white text-blue-950 shadow-sm"
                      : "bg-white/10 text-blue-100 hover:bg-white/20"
                  }`}
                >
                  {sec.name}
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <PageHeader
          eyebrow="Student Information System"
          title="Students Directory"
          description="Browse student cards, edit profiles, download ID cards or marksheets, and admit multiple students back-to-back."
          icon={<GraduationCap className="h-5 w-5" />}
          actions={
            <>
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleExcelImport}
              />
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>Import Excel</span>
              </button>
              <a
                href={exportUrl}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Download className="h-4 w-4" />
                <span>Export .xlsx</span>
              </a>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-800 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>Add Student</span>
              </button>
            </>
          }
        />
      )}

      {/* FILTER & VIEW BAR */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-blue-100/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1 min-w-56">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name, father's name, admission #, B-Form..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-2.5 text-sm font-medium dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <select
          value={classFilter}
          onChange={(e) => selectClassFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="left">Left</option>
          <option value="struck_off">Struck Off</option>
          <option value="passed_out">Passed Out</option>
        </select>

        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All Genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>

        <button
          type="button"
          onClick={() => setTrashed((t) => !t)}
          className={`rounded-xl px-3.5 py-2.5 text-sm font-bold transition cursor-pointer ${
            trashed
              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          {trashed ? "Viewing Trash" : "Trash"}
        </button>

        {/* CARDS / TABLE SWITCH */}
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              viewMode === "cards"
                ? "bg-white text-blue-700 shadow-xs dark:bg-slate-700 dark:text-blue-300"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
            title="Cards View"
          >
            <LayoutGrid className="h-4 w-4" />
            <span>Cards</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              viewMode === "table"
                ? "bg-white text-blue-700 shadow-xs dark:bg-slate-700 dark:text-blue-300"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
            title="Table View"
          >
            <List className="h-4 w-4" />
            <span>Table</span>
          </button>
        </div>
      </div>

      {/* STUDENTS CONTENT: CARDS OR TABLE */}
      {loading ? (
        <div className="flex justify-center py-20 text-blue-600">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-900">
          <GraduationCap className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-3 text-lg font-bold text-slate-800 dark:text-slate-200">
            No students found
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {activeClassObj
              ? `No students are enrolled in ${activeClassObj.name} matching this filter.`
              : "Try adjusting your filters or click Add Student to admit a new student."}
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-800 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Student</span>
          </button>
        </div>
      ) : viewMode === "cards" ? (
        /* ═══ STUDENT CARDS GRID ═══ */
        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {students.map((st) => {
            const pUrl = photoUrl(st.photo_path);
            const enr = st.student_enrollments[0];
            const dlOpen = openDownloadId === st.id;

            return (
              <article
                key={st.id}
                className="relative flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
              >
                {/* TOP: PICTURE THUMBNAIL + STUDENT NAME + FATHER'S NAME */}
                <div>
                  <div className="flex items-start gap-4">
                    {pUrl ? (
                      <img
                        src={pUrl}
                        alt={st.full_name}
                        className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-2 ring-blue-100 shadow-sm dark:ring-slate-700"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-xl font-black text-white shadow-sm">
                        {getInitials(st.full_name)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="truncate text-lg font-extrabold tracking-tight text-slate-950 dark:text-white">
                          {st.full_name}
                        </h3>
                        <Badge variant={statusVariant(st.status)} dot className="shrink-0 text-xs">
                          {st.status.replace("_", " ")}
                        </Badge>
                      </div>

                      {/* FATHER'S NAME */}
                      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300">
                        <User className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span className="truncate">
                          Father: {st.families?.guardian_name ?? "—"}
                        </span>
                      </p>

                      {/* ADMISSION NO & FAMILY ID */}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-mono text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                          {st.admission_no ?? "No Adm #"}
                        </span>
                        {st.families && (
                          <span className="rounded-lg bg-indigo-50 px-2.5 py-1 font-mono text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                            FAM-{st.families.family_number}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CLASS / SECTION / ROLL / DOB STRIP */}
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800/60">
                    <div>
                      <span className="block text-xs font-semibold text-slate-400">
                        Class &amp; Section
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {enr
                          ? `${enr.school_classes?.name ?? "—"} (${enr.class_sections?.name ?? "—"})`
                          : "Unenrolled"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs font-semibold text-slate-400">
                        Roll No / Gender
                      </span>
                      <span className="font-bold capitalize text-slate-900 dark:text-white">
                        {enr?.roll_no ? `#${enr.roll_no}` : "—"} · {st.gender}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ACTION BAR: EDIT, DOWNLOAD, DELETE (+ 360°) */}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  {!trashed ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(st)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-600 hover:text-white dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>

                        {/* DOWNLOAD MENU BUTTON */}
                        <div
                          className="relative"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setOpenDownloadId(dlOpen ? null : st.id)
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-600 hover:text-white dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Download</span>
                          </button>

                          {dlOpen && (
                            <div className="absolute bottom-full left-0 z-30 mb-2 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                              <Link
                                href={`/print/id-card/${st.id}?autoprint=1`}
                                target="_blank"
                                onClick={() => setOpenDownloadId(null)}
                                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <IdCard className="h-4 w-4 text-blue-600" />
                                <span>ID Card (PDF / Print)</span>
                              </Link>
                              <Link
                                href={`/print/marksheet/${st.id}?autoprint=1`}
                                target="_blank"
                                onClick={() => setOpenDownloadId(null)}
                                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <FileText className="h-4 w-4 text-indigo-600" />
                                <span>Marksheet (PDF)</span>
                              </Link>
                              <Link
                                href={`/print/leaving-certificate/${st.id}?autoprint=1`}
                                target="_blank"
                                onClick={() => setOpenDownloadId(null)}
                                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-700 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <GraduationCap className="h-4 w-4 text-amber-600" />
                                <span>Leaving Certificate</span>
                              </Link>
                              <a
                                href={`/api/admin/students/export?studentId=${st.id}`}
                                onClick={() => setOpenDownloadId(null)}
                                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                                <span>Student Sheet (.xlsx)</span>
                              </a>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDelete(st, "soft")}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-600 hover:text-white dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-600 dark:hover:text-white cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>

                      <Link
                        href={`/admin/classes-and-sections?studentId=${st.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-900 hover:text-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
                        title="Open 360° Profile"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>360°</span>
                      </Link>
                    </>
                  ) : (
                    <div className="flex w-full items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(st, "restore")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Restore</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(st, "force")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete Forever</span>
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        /* ═══ TABLE VIEW ═══ */
        <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
                <tr>
                  <th className="px-5 py-3.5">Student</th>
                  <th className="px-5 py-3.5">Father&apos;s Name</th>
                  <th className="px-5 py-3.5">Adm. No</th>
                  <th className="px-5 py-3.5">Class &amp; Section</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map((st) => {
                  const pUrl = photoUrl(st.photo_path);
                  const enr = st.student_enrollments[0];
                  return (
                    <tr
                      key={st.id}
                      className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {pUrl ? (
                            <img
                              src={pUrl}
                              alt={st.full_name}
                              className="h-11 w-11 rounded-xl object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-sm font-black text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                              {getInitials(st.full_name)}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-950 dark:text-white">
                              {st.full_name}
                            </p>
                            <p className="text-xs text-slate-500">
                              DOB: {formatDate(st.dob)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {st.families?.guardian_name ?? "—"}
                        </p>
                        <p className="font-mono text-xs text-indigo-600 dark:text-indigo-400">
                          FAM-{st.families?.family_number ?? "—"}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-blue-700 dark:text-blue-400">
                        {st.admission_no ?? "—"}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap font-medium">
                        {enr
                          ? `${enr.school_classes?.name} (${enr.class_sections?.name})`
                          : "Unenrolled"}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={statusVariant(st.status)} dot>
                          {st.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {!trashed ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(st)}
                              className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-600 hover:text-white cursor-pointer"
                            >
                              Edit
                            </button>
                            <a
                              href={`/api/admin/students/export?studentId=${st.id}`}
                              className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-600 hover:text-white"
                            >
                              Download
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDelete(st, "soft")}
                              className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-600 hover:text-white cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDelete(st, "restore")}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                          >
                            Restore
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTINUOUS MULTI-ENTRY STUDENT ADMISSION MODAL */}
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        title={editing ? "Edit Student Record" : "Admit New Student"}
        subtitle={
          editing
            ? "Update student details and guardian record."
            : "Form stays open after saving so you can admit multiple students back-to-back until you close it."
        }
        maxWidthClass="max-w-3xl"
        preventBackdropClose={!editing}
        headerBadge={
          !editing && addedInSession.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{addedInSession.length} added</span>
            </span>
          ) : !editing ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-600/20 dark:bg-blue-950/60 dark:text-blue-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Multi-Entry Ready</span>
            </span>
          ) : undefined
        }
      >
        <div className="space-y-5 text-sm">
          {!editing && addedInSession.length > 0 && (
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Recently Admitted ({addedInSession.length})
                </p>
                <span className="text-xs text-emerald-700 dark:text-emerald-400">
                  Ready for next student below
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {addedInSession.slice(0, 6).map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-800 shadow-xs ring-1 ring-emerald-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-emerald-800"
                  >
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{item.full_name}</span>
                    {item.admission_no && (
                      <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                        {item.admission_no}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {quickFamilyOpen && (
            <form
              onSubmit={handleQuickFamilyCreate}
              className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3 dark:border-indigo-900/60 dark:bg-indigo-950/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                    Quick Register New Family
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickFamilyOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Father / Guardian Name *</label>
                  <input
                    type="text"
                    required
                    value={quickFamily.guardian_name}
                    onChange={(e) =>
                      setQuickFamily({ ...quickFamily, guardian_name: e.target.value })
                    }
                    placeholder="Full name"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    value={quickFamily.guardian_mobile}
                    onChange={(e) =>
                      setQuickFamily({ ...quickFamily, guardian_mobile: e.target.value })
                    }
                    placeholder="0300-1234567"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">CNIC</label>
                  <input
                    type="text"
                    value={quickFamily.guardian_cnic}
                    onChange={(e) =>
                      setQuickFamily({ ...quickFamily, guardian_cnic: e.target.value })
                    }
                    placeholder="45203-0000000-0"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={quickFamily.address}
                  onChange={(e) =>
                    setQuickFamily({ ...quickFamily, address: e.target.value })
                  }
                  placeholder="Residential address (optional)"
                  className="flex-1 min-w-52 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
                <button
                  type="submit"
                  disabled={savingFamily}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer"
                >
                  {savingFamily ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  <span>Save &amp; Select</span>
                </button>
              </div>
            </form>
          )}

          <form onSubmit={handleSave} className="space-y-5">
            {/* 1. IDENTITY + PHOTO */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center gap-2 mb-4">
                <User className="h-4 w-4 text-blue-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  1. Student Identity
                </h3>
              </div>

              <div className="flex flex-col gap-5 sm:flex-row">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-blue-200 bg-white shadow-xs transition hover:border-blue-500 dark:border-slate-700 dark:bg-slate-900 cursor-pointer"
                  >
                    {form.photo_path ? (
                      <img
                        src={photoUrl(form.photo_path)!}
                        alt="Student"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-400 group-hover:text-blue-600">
                        {uploadingPhoto ? (
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        ) : (
                          <Camera className="h-5 w-5" />
                        )}
                        <span className="text-xs font-bold">Photo</span>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100">
                      {form.photo_path ? "Change" : "Upload"}
                    </div>
                  </button>
                  {form.photo_path && (
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, photo_path: "" }))}
                      className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-3.5">
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        ref={fullNameInputRef}
                        type="text"
                        required
                        value={form.full_name}
                        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                        placeholder="Enter student full name"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Gender <span className="text-rose-500">*</span>
                      </label>
                      <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-white p-1 border border-slate-200 dark:border-slate-700 dark:bg-slate-900">
                        {(["male", "female", "other"] as const).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setForm({ ...form, gender: g })}
                            className={`rounded-lg py-1.5 text-xs font-bold capitalize transition cursor-pointer ${
                              form.gender === g
                                ? "bg-blue-700 text-white shadow-xs"
                                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400"
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Date of Birth <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={form.dob}
                        onChange={(e) => setForm({ ...form, dob: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        B-Form / CNIC No
                      </label>
                      <input
                        type="text"
                        value={form.b_form_no}
                        onChange={(e) => setForm({ ...form, b_form_no: e.target.value })}
                        placeholder="45203-0000000-0"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Previous School
                      </label>
                      <input
                        type="text"
                        value={form.previous_school}
                        onChange={(e) =>
                          setForm({ ...form, previous_school: e.target.value })
                        }
                        placeholder="Optional"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. FAMILY & ADMISSION */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    2. Father / Family &amp; Admission
                  </h3>
                </div>
                {!quickFamilyOpen && (
                  <button
                    type="button"
                    onClick={() => setQuickFamilyOpen(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>New Family</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Father / Guardian <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={form.family_id}
                    onChange={(e) => setForm({ ...form, family_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="">-- Select Family --</option>
                    {families.map((f) => (
                      <option key={f.id} value={String(f.id)}>
                        FAM-{f.family_number} — {f.guardian_name}
                        {f.guardian_mobile ? ` (${f.guardian_mobile})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Admission Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={form.admission_date}
                    onChange={(e) =>
                      setForm({ ...form, admission_date: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Admission No
                  </label>
                  <input
                    type="text"
                    value={form.admission_no}
                    onChange={(e) =>
                      setForm({ ...form, admission_no: e.target.value })
                    }
                    placeholder="Auto-generated"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-white p-1 border border-slate-200 dark:border-slate-700 dark:bg-slate-900">
                    {(
                      [
                        { v: "active", label: "Active" },
                        { v: "left", label: "Left" },
                        { v: "struck_off", label: "Struck Off" },
                        { v: "passed_out", label: "Passed Out" },
                      ] as const
                    ).map(({ v, label }) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setForm({ ...form, status: v })}
                        className={`rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${
                          form.status === v
                            ? "bg-blue-700 text-white shadow-xs"
                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. INSTANT ENROLLMENT */}
            {!editing && currentSession && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-600" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-blue-950 dark:text-blue-200">
                      3. Instant Enrollment ({currentSession.name})
                    </h3>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enrollNow}
                      onChange={(e) => setEnrollNow(e.target.checked)}
                      className="rounded border-blue-300 text-blue-700"
                    />
                    <span>Enroll immediately on save</span>
                  </label>
                </div>

                {enrollNow && (
                  <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Class *
                      </label>
                      <select
                        required={enrollNow}
                        value={form.class_id}
                        onChange={(e) => {
                          const cid = e.target.value;
                          const firstSec = sections.find(
                            (s) => String(s.class_id) === cid,
                          );
                          setForm({
                            ...form,
                            class_id: cid,
                            section_id: firstSec ? String(firstSec.id) : "",
                          });
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      >
                        <option value="">-- Select Class --</option>
                        {classes.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Section *
                      </label>
                      <select
                        required={enrollNow}
                        value={form.section_id}
                        onChange={(e) =>
                          setForm({ ...form, section_id: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      >
                        <option value="">-- Select Section --</option>
                        {filteredModalSections.map((sec) => (
                          <option key={sec.id} value={String(sec.id)}>
                            {sec.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Roll No (Auto-increments)
                      </label>
                      <input
                        type="text"
                        value={form.roll_no}
                        onChange={(e) =>
                          setForm({ ...form, roll_no: e.target.value })
                        }
                        placeholder="e.g. 01"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* FOOTER */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              {!editing ? (
                <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepBatchContext}
                    onChange={(e) => setKeepBatchContext(e.target.checked)}
                    className="rounded border-blue-300 text-blue-700"
                  />
                  <span>Keep Family, Class &amp; Section for next student</span>
                </label>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  {!editing && addedInSession.length > 0 ? "Done & Close" : "Close"}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-extrabold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editing ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  <span>
                    {saving
                      ? "Saving..."
                      : editing
                        ? "Update Student"
                        : "Save & Add Next"}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}

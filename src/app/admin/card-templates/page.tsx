"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Check,
  IdCard,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import {
  CardRenderer,
  type CardStudentData,
  type CardTeacherData,
} from "@/components/cards/CardRenderer";

interface TemplateRow {
  id: number;
  slug: string;
  name: string;
  template_type: "student" | "staff";
  orientation: "portrait" | "landscape";
  front_view: string;
  back_view: string;
  settings: Record<string, unknown> | null;
  is_active: boolean;
  is_default: boolean;
  card_template_class_group: { class_group_id: number }[];
}

interface ClassGroupItem {
  id: number;
  name: string;
}

export default function CardTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroupItem[]>([]);
  const [previewStudent, setPreviewStudent] = useState<CardStudentData | null>(null);
  const [previewTeacher, setPreviewTeacher] = useState<CardTeacherData | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [previewSide, setPreviewSide] = useState<"front" | "back">("front");
  const [loading, setLoading] = useState(true);

  // Create / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    template_type: "student" as "student" | "staff",
    orientation: "portrait" as "portrait" | "landscape",
    front_view: "cards.templates.royal-blue.front",
    back_view: "cards.templates.royal-blue.back",
    settingsJson: "",
    is_active: true,
    is_default: false,
    class_group_ids: [] as number[],
  });
  const [saving, setSaving] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/card-templates");
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.templates ?? []);
        setClassGroups(json.classGroups ?? []);

        if (json.previewStudent) {
          const st = json.previewStudent;
          const enr = st.student_enrollments?.[0];
          setPreviewStudent({
            full_name: st.full_name,
            admission_no: st.admission_no,
            photo_path: st.photo_path,
            family: st.families,
            className: enr?.school_classes?.name,
            sectionName: enr?.class_sections?.name,
          });
        }
        if (json.previewTeacher) {
          setPreviewTeacher(json.previewTeacher);
        }

        if (!selectedId && json.templates?.length > 0) {
          const def =
            json.templates.find((t: TemplateRow) => t.is_default) ??
            json.templates[0];
          setSelectedId(def.id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const selectedTemplate = templates.find((t) => t.id === selectedId) ?? templates[0] ?? null;

  async function handleSetDefault(id: number) {
    const res = await fetch("/api/admin/card-templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      toast.success("Default ID card template updated.");
      loadTemplates();
    } else {
      toast.error("Failed to update default template.");
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      slug: "",
      template_type: "student",
      orientation: "portrait",
      front_view: "cards.templates.royal-blue.front",
      back_view: "cards.templates.royal-blue.back",
      settingsJson: JSON.stringify(
        {
          tagline: "Learning with purpose",
          show_family_number: true,
          show_session_validity: true,
          back_text: "If found, please return this card to the school office.",
        },
        null,
        2,
      ),
      is_active: true,
      is_default: false,
      class_group_ids: [],
    });
    setModalOpen(true);
  }

  function openEdit(t: TemplateRow) {
    setEditing(t);
    setForm({
      name: t.name,
      slug: t.slug,
      template_type: t.template_type,
      orientation: t.orientation,
      front_view: t.front_view,
      back_view: t.back_view,
      settingsJson: t.settings ? JSON.stringify(t.settings, null, 2) : "",
      is_active: t.is_active,
      is_default: t.is_default,
      class_group_ids: t.card_template_class_group.map((g) => g.class_group_id),
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    let parsedSettings: Record<string, unknown> | null = null;
    if (form.settingsJson.trim()) {
      try {
        parsedSettings = JSON.parse(form.settingsJson);
      } catch {
        toast.error("Settings JSON is invalid.");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/card-templates", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          name: form.name,
          slug: form.slug,
          template_type: form.template_type,
          orientation: form.orientation,
          front_view: form.front_view,
          back_view: form.back_view,
          settings: parsedSettings,
          is_active: form.is_active,
          is_default: form.is_default,
          class_group_ids: form.class_group_ids,
        }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast.error(out.error || "Failed to save template.");
        return;
      }
      toast.success(editing ? "Template updated." : "Template created.");
      setModalOpen(false);
      loadTemplates();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Archive this card template?")) return;
    const res = await fetch(`/api/admin/card-templates?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Template archived.");
      loadTemplates();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Identity Card Studio"
        title="Card Templates Gallery"
        description="Preview student and staff ID card designs, customize branding settings, and set the school default."
        icon={<IdCard className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {selectedTemplate && (
              <>
                <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  {(["front", "back"] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setPreviewSide(side)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition cursor-pointer ${
                        previewSide === side
                          ? "bg-blue-700 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {side}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => handleSetDefault(selectedTemplate.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300 cursor-pointer"
                >
                  <Star className="h-3.5 w-3.5" />
                  <span>Set Default</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Test</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-800 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New Template</span>
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-blue-600">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
          {/* TEMPLATE GALLERY */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => {
              const active = selectedTemplate?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedId(t.id);
                    setPreviewSide("front");
                  }}
                  className={`group cursor-pointer rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 ${
                    active
                      ? "border-blue-600 ring-2 ring-blue-500/20"
                      : "border-blue-100 dark:border-slate-800"
                  }`}
                >
                  <div className="flex h-56 items-center justify-center overflow-hidden rounded-xl bg-blue-50/70 p-2 dark:bg-slate-800/70">
                    <div className="scale-[0.56] origin-center pointer-events-none">
                      <CardRenderer
                        template={t}
                        side="front"
                        student={previewStudent}
                        teacher={previewTeacher}
                      />
                    </div>
                  </div>

                  <div className="mt-3.5 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">
                        {t.name}
                      </h3>
                      <p className="mt-0.5 text-[11px] capitalize text-slate-500">
                        {t.template_type} • {t.orientation}
                      </p>
                    </div>
                    {t.is_default && <Badge variant="blue">Default</Badge>}
                  </div>

                  <div
                    className="mt-3 flex items-center justify-end gap-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-800"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => openEdit(t)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800 cursor-pointer"
                      title="Edit template"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-slate-800 cursor-pointer"
                      title="Delete template"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </section>

          {/* LIVE PREVIEW PANEL */}
          <aside className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 h-fit sticky top-20">
            {selectedTemplate ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600">
                      Live Card Preview
                    </p>
                    <h2 className="mt-0.5 text-lg font-black text-slate-950 dark:text-white">
                      {selectedTemplate.name}
                    </h2>
                  </div>
                  <Badge variant="indigo">{previewSide}</Badge>
                </div>

                <div className="mt-5 flex min-h-[24rem] items-center justify-center overflow-auto rounded-2xl bg-blue-50/80 p-6 dark:bg-slate-800/60">
                  <CardRenderer
                    template={selectedTemplate}
                    side={previewSide}
                    student={previewStudent}
                    teacher={previewTeacher}
                  />
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-4 text-xs">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                    <dt className="text-slate-400 font-bold uppercase text-[10px]">
                      Card Type
                    </dt>
                    <dd className="mt-0.5 font-extrabold capitalize text-slate-900 dark:text-white">
                      {selectedTemplate.template_type}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                    <dt className="text-slate-400 font-bold uppercase text-[10px]">
                      Orientation
                    </dt>
                    <dd className="mt-0.5 font-extrabold capitalize text-slate-900 dark:text-white">
                      {selectedTemplate.orientation}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <div className="py-24 text-center text-xs text-slate-400">
                Select a template to preview it.
              </div>
            )}
          </aside>
        </div>
      )}

      {/* CREATE/EDIT TEMPLATE MODAL */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Card Template" : "Create Card Template"}
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-bold mb-1">Template Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm({
                    ...form,
                    name,
                    slug: editing
                      ? form.slug
                      : name
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-|-$/g, ""),
                  });
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Slug *</label>
              <input
                type="text"
                required
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Card Type *</label>
              <select
                value={form.template_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    template_type: e.target.value as "student" | "staff",
                  })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="student">Student</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Orientation *</label>
              <select
                value={form.orientation}
                onChange={(e) =>
                  setForm({
                    ...form,
                    orientation: e.target.value as "portrait" | "landscape",
                  })
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1">Settings (JSON)</label>
            <textarea
              rows={5}
              value={form.settingsJson}
              onChange={(e) => setForm({ ...form, settingsJson: e.target.value })}
              className="w-full rounded-xl border border-slate-200 p-3 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          {classGroups.length > 0 && (
            <div>
              <label className="block font-bold mb-2">Assigned Class Groups</label>
              <div className="flex flex-wrap gap-2">
                {classGroups.map((cg) => {
                  const checked = form.class_group_ids.includes(cg.id);
                  return (
                    <label
                      key={cg.id}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 cursor-pointer dark:border-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setForm({
                            ...form,
                            class_group_ids: checked
                              ? form.class_group_ids.filter((x) => x !== cg.id)
                              : [...form.class_group_ids, cg.id],
                          })
                        }
                      />
                      <span>{cg.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-6">
            <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <span>Active</span>
            </label>
            <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              />
              <span>Default Template</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-5 py-2 font-bold text-white hover:bg-blue-800 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>{saving ? "Saving..." : "Save Template"}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

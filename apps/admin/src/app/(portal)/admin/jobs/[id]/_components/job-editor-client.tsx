"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  createJob,
  updateJob,
  jobSchema,
  type JobFormValues,
  listDepartmentsForCampus,
} from "../../../_actions/jobs";
import { EditorHeader } from "../../../_components/editor-header";
import { PreviewPanel } from "../../../_components/preview-panel";
import {
  PortalField,
  PortalInput,
  PortalSelect,
  PortalTextarea,
} from "../../../_components/portal-fields";
import { PortalButton } from "../../../_components/portal-button";
import type {
  Jobs,
  ContentTranslations,
  Campus,
  Departments,
} from "@repo/api/types/appwrite";

type JobWithTranslations = Jobs & { translation_refs: ContentTranslations[] };

type JobEditorClientProps = {
  job: JobWithTranslations | null;
  campuses: Campus[];
  initialDepartments: Departments[];
  isNew: boolean;
  labels: {
    back: string;
    titlePlaceholder: string;
    company: string;
    employmentType: string;
    descriptionNo: string;
    descriptionEn: string;
    campus: string;
    department: string;
    slug: string;
    status: string;
    discard: string;
    saveDraft: string;
    publish: string;
    preview: string;
    saveSuccess: string;
    saveError: string;
    publishSuccess: string;
    publishError: string;
  };
};

const EMPLOYMENT_TYPES = [
  { value: "", label: "— Select type —" },
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "internship", label: "Internship" },
  { value: "freelance", label: "Freelance" },
  { value: "volunteer", label: "Volunteer" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "closed", label: "Closed" },
];

function buildDefaultValues(job: JobWithTranslations | null): JobFormValues {
  const no = job?.translation_refs.find((t) => t.locale === "no");
  const en = job?.translation_refs.find((t) => t.locale === "en");
  let extra: Record<string, string> = {};
  if (no?.additional_fields) {
    try { extra = JSON.parse(no.additional_fields); } catch { /* ignore */ }
  }
  return {
    title_no: no?.title ?? "",
    title_en: en?.title ?? "",
    description_no: no?.description ?? "",
    description_en: en?.description ?? "",
    campus_id: job?.campus_id ?? "",
    department_id: job?.department_id ?? null,
    slug: job?.slug ?? "",
    status: (job?.status as JobFormValues["status"]) ?? "draft",
    employment_type: extra.employment_type ?? null,
    company: extra.company ?? null,
  };
}

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
}

export function JobEditorClient({
  job,
  campuses,
  initialDepartments,
  isNew,
  labels,
}: JobEditorClientProps) {
  const router = useRouter();
  const [departments, setDepartments] = useState(initialDepartments);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Preview state
  const [previewTitle, setPreviewTitle] = useState(
    job?.translation_refs.find((t) => t.locale === "no")?.title ?? ""
  );
  const [previewCompany, setPreviewCompany] = useState(() => {
    const t = job?.translation_refs.find((t) => t.locale === "no");
    if (t?.additional_fields) { try { return JSON.parse(t.additional_fields).company ?? ""; } catch { return ""; } }
    return "";
  });
  const [previewType, setPreviewType] = useState(() => {
    const t = job?.translation_refs.find((t) => t.locale === "no");
    if (t?.additional_fields) { try { return JSON.parse(t.additional_fields).employment_type ?? ""; } catch { return ""; } }
    return "";
  });
  const [previewSlug, setPreviewSlug] = useState(job?.slug ?? "");

  const form = useForm({
    defaultValues: buildDefaultValues(job),
    onSubmit: async ({ value }) => {
      const validated = jobSchema.safeParse(value);
      if (!validated.success) {
        toast.error(labels.saveError);
        return;
      }
      const result = isNew ? await createJob(validated.data) : await updateJob(job!.$id, validated.data);
      if (result.error) { toast.error(labels.saveError); return; }
      toast.success(isPublishing ? labels.publishSuccess : labels.saveSuccess);
      if (isNew && result.data) router.push(`/admin/jobs/${result.data}`);
    },
  });

  async function handleCampusChange(campusId: string) {
    form.setFieldValue("campus_id", campusId);
    form.setFieldValue("department_id", null);
    if (campusId) {
      const depts = await listDepartmentsForCampus(campusId);
      setDepartments(depts);
    } else {
      setDepartments([]);
    }
  }

  const campusOptions = [
    { value: "", label: "— Select campus —" },
    ...campuses.map((c) => ({ value: c.$id, label: c.name })),
  ];

  const departmentOptions = [
    { value: "", label: "— Any department —" },
    ...departments.map((d) => ({ value: d.$id, label: d.Name })),
  ];

  const editorTitle = isNew
    ? "New Job"
    : (job?.translation_refs.find((t) => t.locale === "no")?.title ?? "Edit Job");

  return (
    <div className="pb-12">
      <EditorHeader backHref="/admin/jobs" backLabel={labels.back} title={editorTitle} status={isNew ? undefined : job?.status}>
        <PortalButton variant="ghost" size="sm" onClick={() => router.push("/admin/jobs")}>{labels.discard}</PortalButton>
        <PortalButton variant="secondary" size="sm" loading={isSaving} onClick={() => { setIsSaving(true); form.setFieldValue("status", "draft"); form.handleSubmit().finally(() => setIsSaving(false)); }}>{labels.saveDraft}</PortalButton>
        <PortalButton variant="primary" size="sm" loading={isPublishing} onClick={() => { setIsPublishing(true); form.setFieldValue("status", "published"); form.handleSubmit().finally(() => setIsPublishing(false)); }}>{labels.publish}</PortalButton>
      </EditorHeader>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="title_no">
              {(field) => (
                <PortalField label={`${labels.titlePlaceholder} (NO)`} required>
                  <PortalInput
                    value={field.state.value}
                    onBlur={() => {
                      field.handleBlur();
                      if (!form.getFieldValue("slug") || isNew) form.setFieldValue("slug", generateSlug(field.state.value));
                      setPreviewSlug(form.getFieldValue("slug") || generateSlug(field.state.value));
                    }}
                    onChange={(e) => { field.handleChange(e.target.value); setPreviewTitle(e.target.value); }}
                    placeholder="Tittel på stilling..."
                  />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="title_en">
              {(field) => (
                <PortalField label={`${labels.titlePlaceholder} (EN)`}>
                  <PortalInput value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} placeholder="Job title..." />
                </PortalField>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="company">
              {(field) => (
                <PortalField label={labels.company}>
                  <PortalInput value={field.state.value ?? ""} onBlur={field.handleBlur} onChange={(e) => { field.handleChange(e.target.value); setPreviewCompany(e.target.value); }} placeholder="Company name..." />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="employment_type">
              {(field) => (
                <PortalField label={labels.employmentType}>
                  <PortalSelect value={field.state.value ?? ""} onChange={(e) => { field.handleChange(e.target.value || null); setPreviewType(e.target.value); }} options={EMPLOYMENT_TYPES} />
                </PortalField>
              )}
            </form.Field>
          </div>

          <form.Field name="description_no">
            {(field) => (
              <PortalField label={labels.descriptionNo} required>
                <PortalTextarea rows={6} value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} placeholder="Stillingsbeskrivelse på norsk..." />
              </PortalField>
            )}
          </form.Field>

          <form.Field name="description_en">
            {(field) => (
              <PortalField label={labels.descriptionEn} required>
                <PortalTextarea rows={6} value={field.state.value} onBlur={field.handleBlur} onChange={(e) => field.handleChange(e.target.value)} placeholder="Job description in English..." />
              </PortalField>
            )}
          </form.Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="campus_id">
              {(field) => (
                <PortalField label={labels.campus} required>
                  <PortalSelect value={field.state.value} onChange={(e) => { field.handleChange(e.target.value); handleCampusChange(e.target.value); }} options={campusOptions} />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="department_id">
              {(field) => (
                <PortalField label={labels.department}>
                  <PortalSelect value={field.state.value ?? ""} onChange={(e) => field.handleChange(e.target.value || null)} options={departmentOptions} disabled={departments.length === 0} />
                </PortalField>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="slug">
              {(field) => (
                <PortalField label={labels.slug} hint="Lowercase letters, numbers and hyphens" required>
                  <PortalInput value={field.state.value} onBlur={field.handleBlur} onChange={(e) => { field.handleChange(e.target.value); setPreviewSlug(e.target.value); }} placeholder="job-title-slug" className="font-mono text-xs" />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="status">
              {(field) => (
                <PortalField label={labels.status}>
                  <PortalSelect value={field.state.value} onChange={(e) => field.handleChange(e.target.value as JobFormValues["status"])} options={STATUS_OPTIONS} />
                </PortalField>
              )}
            </form.Field>
          </div>
        </div>

        <div className="lg:sticky lg:top-32 self-start">
          <PreviewPanel title={labels.preview}>
            <div className="rounded-2xl p-5 space-y-3" style={{ background: "linear-gradient(135deg, rgba(61,169,224,0.05) 0%, rgba(0,23,49,0.50) 100%)", border: "1px solid rgba(61,169,224,0.15)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(61,169,224,0.15)", border: "1px solid rgba(61,169,224,0.25)" }}>
                <span className="text-lg">💼</span>
              </div>
              <div>
                <p className="font-semibold text-base leading-tight" style={{ color: "#fff" }}>{previewTitle || "Job Title"}</p>
                {previewCompany && <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.50)" }}>{previewCompany}</p>}
              </div>
              {previewType && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium" style={{ background: "rgba(61,169,224,0.10)", border: "1px solid rgba(61,169,224,0.25)", color: "#3DA9E0" }}>{previewType}</span>
              )}
              <div className="pt-3 mt-3 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.30)" }}>/{previewSlug || "job-slug"}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(61,169,224,0.10)", color: "#3DA9E0" }}>Apply →</span>
              </div>
            </div>
          </PreviewPanel>
        </div>
      </div>
    </div>
  );
}

"use client";

import {
  type Campus,
  type Departments,
  JobStatus,
} from "@repo/api/types/appwrite";
import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import { ContentEditor } from "@repo/ui/components/content-editor";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  createJob,
  listDepartmentsForCampus,
  updateJob,
} from "../../../_actions/jobs";
import { type JobFormValues, jobSchema } from "../../../_actions/schemas";
import { EditorHeader } from "../../../_components/editor-header";
import { PortalButton } from "../../../_components/portal-button";
import {
  PortalField,
  PortalInput,
  PortalSelect,
  PortalTextarea,
} from "../../../_components/portal-fields";
import { PreviewPanel } from "../../../_components/preview-panel";

interface JobEditorClientProps {
  campuses: Campus[];
  initialDepartments: Departments[];
  isNew: boolean;
  job: RecruitmentVacancy | null;
  labels: {
    applicationDeadline: string;
    back: string;
    company: string;
    contactEmail: string;
    contactName: string;
    cvRequired: string;
    department: string;
    descriptionEn: string;
    descriptionNo: string;
    discard: string;
    employmentType: string;
    location: string;
    paid: string;
    preview: string;
    publish: string;
    publishError: string;
    publishSuccess: string;
    saveDraft: string;
    saveError: string;
    saveSuccess: string;
    shortDescription: string;
    slug: string;
    status: string;
    titlePlaceholder: string;
    campus: string;
  };
}

const EMPLOYMENT_TYPES = [
  { value: "", label: "— Select type —" },
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "internship", label: "Internship" },
  { value: "freelance", label: "Freelance" },
  { value: "volunteer", label: "Volunteer" },
];

const STATUS_OPTIONS = [
  { value: JobStatus.DRAFT, label: "Draft" },
  { value: JobStatus.PUBLISHED, label: "Published" },
  { value: JobStatus.CLOSED, label: "Closed" },
];

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function toDateTimeInput(value: string | null | undefined): string {
  return value ? value.slice(0, 16) : "";
}

function buildDefaultValues(job: RecruitmentVacancy | null): JobFormValues {
  const no = job?.translation_refs.find(
    (translation) => translation.locale === "no"
  );
  const en = job?.translation_refs.find(
    (translation) => translation.locale === "en"
  );

  return {
    application_deadline: job?.metadata.application_deadline ?? null,
    campus_id: job?.campus_id ?? "",
    company: job?.metadata.company ?? null,
    contact_email: job?.metadata.contact_email ?? null,
    contact_name: job?.metadata.contact_name ?? null,
    cv_required: Boolean(job?.metadata.cv_required),
    department_id: job?.department_id ?? null,
    description_en: en?.description ?? "",
    description_no: no?.description ?? "",
    employment_type: job?.metadata.employment_type ?? null,
    location: job?.metadata.location ?? null,
    paid: Boolean(job?.metadata.paid),
    short_description: job?.metadata.short_description ?? null,
    slug: job?.slug ?? "",
    status: job?.status ?? JobStatus.DRAFT,
    title_en: en?.title ?? "",
    title_no: no?.title ?? "",
  };
}

export function JobEditorClient({
  campuses,
  initialDepartments,
  isNew,
  job,
  labels,
}: JobEditorClientProps) {
  const router = useRouter();
  const [departments, setDepartments] = useState(initialDepartments);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewTitle, setPreviewTitle] = useState(
    job?.translation_refs.find((translation) => translation.locale === "no")
      ?.title ?? ""
  );
  const [previewCompany, setPreviewCompany] = useState(
    job?.metadata.company ?? ""
  );
  const [previewSlug, setPreviewSlug] = useState(job?.slug ?? "");

  const form = useForm({
    defaultValues: buildDefaultValues(job),
    onSubmit: async ({ value }) => {
      const validated = jobSchema.safeParse(value);
      if (!validated.success) {
        toast.error(labels.saveError);
        return;
      }

      const result = isNew
        ? await createJob(validated.data)
        : await updateJob(job!.$id, validated.data);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isPublishing ? labels.publishSuccess : labels.saveSuccess);
      if (isNew && result.data) {
        router.push(`/jobs/${result.data}`);
      }
    },
  });

  async function handleCampusChange(campusId: string) {
    form.setFieldValue("campus_id", campusId);
    form.setFieldValue("department_id", null);
    const nextDepartments = campusId
      ? await listDepartmentsForCampus(campusId)
      : [];
    setDepartments(nextDepartments);
  }

  const campusOptions = [
    { value: "", label: "— Select campus —" },
    ...campuses.map((campus) => ({ value: campus.$id, label: campus.name })),
  ];
  const departmentOptions = [
    { value: "", label: "— Any department —" },
    ...departments.map((department) => ({
      value: department.$id,
      label: department.Name,
    })),
  ];

  return (
    <div className="pb-12">
      <EditorHeader
        backHref="/jobs"
        backLabel={labels.back}
        status={isNew ? undefined : job?.status}
        title={isNew ? "New Vacancy" : previewTitle || "Edit Vacancy"}
      >
        <PortalButton
          onClick={() => router.push("/jobs")}
          size="sm"
          variant="ghost"
        >
          {labels.discard}
        </PortalButton>
        <PortalButton
          loading={isSaving}
          onClick={() => {
            setIsSaving(true);
            form.setFieldValue("status", JobStatus.DRAFT);
            form.handleSubmit().finally(() => setIsSaving(false));
          }}
          size="sm"
          variant="secondary"
        >
          {labels.saveDraft}
        </PortalButton>
        <PortalButton
          loading={isPublishing}
          onClick={() => {
            setIsPublishing(true);
            form.setFieldValue("status", JobStatus.PUBLISHED);
            form.handleSubmit().finally(() => setIsPublishing(false));
          }}
          size="sm"
          variant="primary"
        >
          {labels.publish}
        </PortalButton>
      </EditorHeader>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="title_no">
              {(field) => (
                <PortalField label={`${labels.titlePlaceholder} (NO)`} required>
                  <PortalInput
                    onBlur={() => {
                      field.handleBlur();
                      if (!form.getFieldValue("slug") || isNew) {
                        const slug = generateSlug(field.state.value);
                        form.setFieldValue("slug", slug);
                        setPreviewSlug(slug);
                      }
                    }}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      setPreviewTitle(event.target.value);
                    }}
                    placeholder="Tittel på stilling..."
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>

            <form.Field name="title_en">
              {(field) => (
                <PortalField label={`${labels.titlePlaceholder} (EN)`} required>
                  <PortalInput
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Vacancy title..."
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="company">
              {(field) => (
                <PortalField label={labels.company}>
                  <PortalInput
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      setPreviewCompany(event.target.value);
                    }}
                    placeholder="BISO"
                    value={field.state.value ?? ""}
                  />
                </PortalField>
              )}
            </form.Field>

            <form.Field name="employment_type">
              {(field) => (
                <PortalField label={labels.employmentType}>
                  <PortalSelect
                    onChange={(event) =>
                      field.handleChange(event.target.value || null)
                    }
                    options={EMPLOYMENT_TYPES}
                    value={field.state.value ?? ""}
                  />
                </PortalField>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="short_description">
              {(field) => (
                <PortalField label={labels.shortDescription}>
                  <PortalTextarea
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(event.target.value || null)
                    }
                    rows={3}
                    value={field.state.value ?? ""}
                  />
                </PortalField>
              )}
            </form.Field>

            <div className="grid gap-4">
              <form.Field name="location">
                {(field) => (
                  <PortalField label={labels.location}>
                    <PortalInput
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value || null)
                      }
                      value={field.state.value ?? ""}
                    />
                  </PortalField>
                )}
              </form.Field>

              <form.Field name="application_deadline">
                {(field) => (
                  <PortalField label={labels.applicationDeadline}>
                    <PortalInput
                      onChange={(event) =>
                        field.handleChange(event.target.value || null)
                      }
                      type="datetime-local"
                      value={toDateTimeInput(field.state.value)}
                    />
                  </PortalField>
                )}
              </form.Field>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="contact_name">
              {(field) => (
                <PortalField label={labels.contactName}>
                  <PortalInput
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(event.target.value || null)
                    }
                    value={field.state.value ?? ""}
                  />
                </PortalField>
              )}
            </form.Field>

            <form.Field name="contact_email">
              {(field) => (
                <PortalField label={labels.contactEmail}>
                  <PortalInput
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(event.target.value || null)
                    }
                    type="email"
                    value={field.state.value ?? ""}
                  />
                </PortalField>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="paid">
              {(field) => (
                <PortalField label={labels.paid}>
                  <label className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white">
                    <input
                      checked={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.checked)
                      }
                      type="checkbox"
                    />
                    Paid vacancy
                  </label>
                </PortalField>
              )}
            </form.Field>

            <form.Field name="cv_required">
              {(field) => (
                <PortalField label={labels.cvRequired}>
                  <label className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white">
                    <input
                      checked={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.checked)
                      }
                      type="checkbox"
                    />
                    Require CV upload
                  </label>
                </PortalField>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <form.Field name="campus_id">
              {(field) => (
                <PortalField label={labels.campus} required>
                  <PortalSelect
                    onChange={(event) => {
                      handleCampusChange(event.target.value);
                    }}
                    options={campusOptions}
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>

            <form.Field name="department_id">
              {(field) => (
                <PortalField label={labels.department}>
                  <PortalSelect
                    onChange={(event) =>
                      field.handleChange(event.target.value || null)
                    }
                    options={departmentOptions}
                    value={field.state.value ?? ""}
                  />
                </PortalField>
              )}
            </form.Field>

            <form.Field name="status">
              {(field) => (
                <PortalField label={labels.status} required>
                  <PortalSelect
                    onChange={(event) =>
                      field.handleChange(
                        event.target.value as JobFormValues["status"]
                      )
                    }
                    options={STATUS_OPTIONS}
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>
          </div>

          <form.Field name="slug">
            {(field) => (
              <PortalField label={labels.slug} required>
                <PortalInput
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                    setPreviewSlug(event.target.value);
                  }}
                  value={field.state.value}
                />
              </PortalField>
            )}
          </form.Field>

          <form.Field name="description_no">
            {(field) => (
              <PortalField label={labels.descriptionNo} required>
                <ContentEditor
                  minHeight={240}
                  onChange={(value) => field.handleChange(value)}
                  placeholder="Stillingsbeskrivelse på norsk..."
                  value={field.state.value}
                  variant="jobs"
                />
              </PortalField>
            )}
          </form.Field>

          <form.Field name="description_en">
            {(field) => (
              <PortalField label={labels.descriptionEn} required>
                <ContentEditor
                  minHeight={240}
                  onChange={(value) => field.handleChange(value)}
                  placeholder="Vacancy description in English..."
                  value={field.state.value}
                  variant="jobs"
                />
              </PortalField>
            )}
          </form.Field>
        </div>

        <PreviewPanel title={labels.preview}>
          <div
            className="rounded-3xl border p-6"
            style={{
              background: "rgba(255,255,255,0.03)",
              borderColor: "rgba(255,255,255,0.08)",
            }}
          >
            <div className="space-y-3">
              <p className="font-mono text-[11px] text-white/40 uppercase tracking-widest">
                Vacancy preview
              </p>
              <h3 className="font-semibold text-2xl text-white">
                {previewTitle || "Vacancy title"}
              </h3>
              <p className="text-sm text-white/60">
                {previewCompany || "Company"} · {previewSlug || "slug"}
              </p>
            </div>
          </div>
        </PreviewPanel>
      </div>
    </div>
  );
}

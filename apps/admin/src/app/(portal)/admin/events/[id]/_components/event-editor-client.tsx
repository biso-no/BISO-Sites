"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createEvent, updateEvent } from "../../../_actions/events";
import { type EventFormValues, eventSchema } from "../../../_actions/schemas";
import { EditorHeader } from "../../../_components/editor-header";
import { PreviewPanel } from "../../../_components/preview-panel";
import { PortalField, PortalInput, PortalSelect } from "../../../_components/portal-fields";
import { ImageUploadField } from "../../../_components/image-upload-field";
import { PortalButton } from "../../../_components/portal-button";
import { ContentEditor } from "@repo/ui/components/content-editor";
import type { Events, ContentTranslations, Campus } from "@repo/api/types/appwrite";

type EventWithTranslations = Events & { translation_refs: ContentTranslations[] };

type EventEditorClientProps = {
  event: EventWithTranslations | null;
  campuses: Campus[];
  isNew: boolean;
  labels: Record<string, string>;
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "cancelled", label: "Cancelled" },
];

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function EventEditorClient({ event, campuses, isNew, labels }: EventEditorClientProps) {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const defaultCampusId = campuses[0]?.$id ?? "";

  const noTranslation = event?.translation_refs.find((t) => t.locale === "no");
  const enTranslation = event?.translation_refs.find((t) => t.locale === "en");

  const [previewTitle, setPreviewTitle] = useState(noTranslation?.title ?? "");
  const [previewLocation, setPreviewLocation] = useState(event?.location ?? "");
  const [previewDate, setPreviewDate] = useState(event?.start_date ?? "");
  const [previewImage, setPreviewImage] = useState(event?.image ?? "");

  const form = useForm({
    defaultValues: {
      title_no: noTranslation?.title ?? "",
      title_en: enTranslation?.title ?? "",
      description_no: noTranslation?.description ?? null,
      description_en: enTranslation?.description ?? null,
      campus_id: event?.campus_id ?? defaultCampusId,
      department_id: event?.department_id ?? null,
      slug: event?.slug ?? "",
      status: (event?.status as EventFormValues["status"]) ?? "draft",
      start_date: event?.start_date ?? null,
      end_date: event?.end_date ?? null,
      location: event?.location ?? null,
      image: event?.image ?? null,
      price: event?.price ?? null,
      ticket_url: event?.ticket_url ?? null,
      member_only: event?.member_only ?? false,
    },
    onSubmit: async ({ value }) => {
      const validated = eventSchema.safeParse(value);
      if (!validated.success) {
        toast.error(labels.saveError);
        return;
      }
      const result = isNew
        ? await createEvent(validated.data)
        : await updateEvent(event!.$id, validated.data);
      if (result.error) {
        toast.error(labels.saveError);
        return;
      }
      toast.success(isPublishing ? labels.publishSuccess : labels.saveSuccess);
      if (isNew && result.data) router.push(`/admin/events/${result.data}`);
    },
  });

  const campusOptions = [
    { value: "", label: "— Select campus —" },
    ...campuses.map((c) => ({ value: c.$id, label: c.name })),
  ];

  return (
    <div className="pb-12">
      <EditorHeader
        backHref="/admin/events"
        backLabel={labels.back}
        title={isNew ? "New Event" : (noTranslation?.title ?? "Edit Event")}
        status={isNew ? undefined : event?.status}
      >
        <PortalButton variant="ghost" size="sm" onClick={() => router.push("/admin/events")}>
          {labels.discard}
        </PortalButton>
        <PortalButton
          variant="secondary"
          size="sm"
          loading={isSaving}
          onClick={() => {
            setIsSaving(true);
            form.setFieldValue("status", "draft");
            form.handleSubmit().finally(() => setIsSaving(false));
          }}
        >
          {labels.saveDraft}
        </PortalButton>
        <PortalButton
          variant="primary"
          size="sm"
          loading={isPublishing}
          onClick={() => {
            setIsPublishing(true);
            form.setFieldValue("status", "published");
            form.handleSubmit().finally(() => setIsPublishing(false));
          }}
        >
          {labels.publish}
        </PortalButton>
      </EditorHeader>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <div className="space-y-5">
          {/* Titles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="title_no">
              {(field) => (
                <PortalField label={labels.titleNo} required>
                  <PortalInput
                    value={field.state.value}
                    onBlur={() => {
                      field.handleBlur();
                      if (isNew && !form.getFieldValue("slug")) {
                        form.setFieldValue("slug", generateSlug(field.state.value));
                      }
                    }}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                      setPreviewTitle(e.target.value);
                    }}
                    placeholder="Arrangementstittel..."
                  />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="title_en">
              {(field) => (
                <PortalField label={labels.titleEn}>
                  <PortalInput
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Event title..."
                  />
                </PortalField>
              )}
            </form.Field>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="start_date">
              {(field) => (
                <PortalField label={labels.startDate}>
                  <PortalInput
                    type="datetime-local"
                    value={field.state.value ?? ""}
                    onChange={(e) => {
                      field.handleChange(e.target.value || null);
                      setPreviewDate(e.target.value);
                    }}
                  />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="end_date">
              {(field) => (
                <PortalField label={labels.endDate}>
                  <PortalInput
                    type="datetime-local"
                    value={field.state.value ?? ""}
                    onChange={(e) => field.handleChange(e.target.value || null)}
                  />
                </PortalField>
              )}
            </form.Field>
          </div>

          {/* Location + Price */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="location">
              {(field) => (
                <PortalField label={labels.location}>
                  <PortalInput
                    value={field.state.value ?? ""}
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(e.target.value || null);
                      setPreviewLocation(e.target.value);
                    }}
                    placeholder="Oslo, Auditorium A..."
                  />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="price">
              {(field) => (
                <PortalField label={labels.ticketPrice}>
                  <PortalInput
                    type="number"
                    min="0"
                    value={field.state.value ?? ""}
                    onChange={(e) =>
                      field.handleChange(e.target.value ? Number(e.target.value) : null)
                    }
                    placeholder="0"
                  />
                </PortalField>
              )}
            </form.Field>
          </div>

          {/* Cover image upload */}
          <form.Field name="image">
            {(field) => (
              <PortalField label={labels.coverImage}>
                <ImageUploadField
                  value={field.state.value}
                  onChange={(url) => {
                    field.handleChange(url);
                    setPreviewImage(url ?? "");
                  }}
                />
              </PortalField>
            )}
          </form.Field>

          {/* Norwegian body */}
          <form.Field name="description_no">
            {(field) => (
              <PortalField label={labels.descriptionNo}>
                <ContentEditor
                  variant="events"
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v || null)}
                  placeholder="Beskrivelse..."
                  minHeight={200}
                />
              </PortalField>
            )}
          </form.Field>

          {/* English body */}
          <form.Field name="description_en">
            {(field) => (
              <PortalField label={labels.descriptionEn}>
                <ContentEditor
                  variant="events"
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v || null)}
                  placeholder="Description (English)..."
                  minHeight={160}
                />
              </PortalField>
            )}
          </form.Field>

          {/* Campus + Slug */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="campus_id">
              {(field) => (
                <PortalField label={labels.campus} required>
                  <PortalSelect
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    options={campusOptions}
                  />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="slug">
              {(field) => (
                <PortalField label={labels.slug} required>
                  <PortalInput
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="font-mono text-xs"
                  />
                </PortalField>
              )}
            </form.Field>
          </div>

          {/* Status + Ticket URL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="status">
              {(field) => (
                <PortalField label={labels.status}>
                  <PortalSelect
                    value={field.state.value}
                    onChange={(e) =>
                      field.handleChange(e.target.value as EventFormValues["status"])
                    }
                    options={STATUS_OPTIONS}
                  />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="ticket_url">
              {(field) => (
                <PortalField label={labels.ticketUrl}>
                  <PortalInput
                    value={field.state.value ?? ""}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value || null)}
                    placeholder="https://..."
                  />
                </PortalField>
              )}
            </form.Field>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-32 self-start">
          <PreviewPanel title={labels.preview}>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div
                className="relative h-32 overflow-hidden"
                style={{ background: "rgba(61,169,224,0.05)" }}
              >
                {previewImage ? (
                  <img src={previewImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-3xl">🎉</span>
                  </div>
                )}
                {previewDate && (
                  <div
                    className="absolute bottom-3 left-3 px-2 py-1 rounded-lg text-xs font-mono"
                    style={{ background: "rgba(0,0,0,0.70)", color: "#fff" }}
                  >
                    {new Date(previewDate).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="font-semibold text-sm" style={{ color: "#fff" }}>
                  {previewTitle || "Event Title"}
                </p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.40)" }}>
                  {previewLocation || "Location TBD"}
                </p>
              </div>
            </div>
          </PreviewPanel>
        </div>
      </div>
    </div>
  );
}

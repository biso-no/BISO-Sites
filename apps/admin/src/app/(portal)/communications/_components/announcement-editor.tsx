"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { Announcements } from "@/lib/announcements/types";
import {
  createAnnouncement,
  sendAnnouncement,
  updateAnnouncement,
} from "../../_actions/announcements";
import {
  type AnnouncementFormValues,
  announcementSchema,
} from "../../_actions/schemas";
import { EditorHeader } from "../../_components/editor-header";
import { PortalButton } from "../../_components/portal-button";
import {
  PortalField,
  PortalInput,
  PortalSelect,
  PortalTextarea,
} from "../../_components/portal-fields";
import { STUDIO } from "../../_components/studio";

interface CampusOption {
  id: string;
  name: string;
}

interface AnnouncementEditorProps {
  allowGlobalCampus: boolean;
  announcement: Announcements | null;
  campuses: CampusOption[];
  defaultCampusId: string;
  isNew: boolean;
}

const CATEGORY_OPTIONS = [
  { value: "general", label: "General" },
  { value: "trip", label: "Trip" },
  { value: "urgent", label: "Urgent" },
  { value: "event", label: "Event" },
];

const AUDIENCE_OPTIONS = [
  { value: "broadcast", label: "All app users (broadcast)" },
  { value: "topic", label: "Topic" },
  { value: "users", label: "Specific users" },
];

const TOPIC_OPTIONS = [
  { value: "events", label: "Events" },
  { value: "products", label: "Products" },
  { value: "jobs", label: "Jobs" },
];

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: form manages conditional audience fields and a save/send flow
export function AnnouncementEditor({
  allowGlobalCampus,
  announcement,
  campuses,
  defaultCampusId,
  isNew,
}: AnnouncementEditorProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // For an existing "users" audience, audience_value is a JSON array of ids;
  // present it as a comma-separated list for editing.
  let initialAudienceValue = announcement?.audience_value ?? "";
  if (announcement?.audience_type === "users" && announcement.audience_value) {
    try {
      const parsed = JSON.parse(announcement.audience_value);
      if (Array.isArray(parsed)) {
        initialAudienceValue = parsed.join(", ");
      }
    } catch {
      // leave as-is
    }
  }

  const form = useForm({
    defaultValues: {
      title_en: announcement?.title_en ?? "",
      title_no: announcement?.title_no ?? null,
      body_en: announcement?.body_en ?? null,
      body_no: announcement?.body_no ?? null,
      category:
        (announcement?.category as AnnouncementFormValues["category"]) ??
        "general",
      audience_type:
        (announcement?.audience_type as AnnouncementFormValues["audience_type"]) ??
        "broadcast",
      audience_value: initialAudienceValue,
      event_id: announcement?.event_id ?? null,
      campus_id: announcement?.campus_id ?? defaultCampusId ?? null,
      push: announcement?.push ?? true,
      scheduled_at: announcement?.scheduled_at ?? null,
    } as AnnouncementFormValues,
    onSubmit: async ({ value }) => {
      await persist(value);
    },
  });

  async function persist(
    value: AnnouncementFormValues
  ): Promise<string | null> {
    const validated = announcementSchema.safeParse(value);
    if (!validated.success) {
      toast.error("Please fix the highlighted fields.");
      return null;
    }
    const result = isNew
      ? await createAnnouncement(validated.data)
      : await updateAnnouncement(announcement!.$id, validated.data);
    if (result.error) {
      toast.error(
        typeof result.error === "string"
          ? result.error
          : "Failed to save announcement"
      );
      return null;
    }
    return typeof result.data === "string" ? result.data : announcement!.$id;
  }

  async function handleSaveDraft() {
    setIsSaving(true);
    try {
      const id = await persist(form.state.values);
      if (id) {
        toast.success("Draft saved");
        if (isNew) {
          router.push(`/communications/${id}`);
        }
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendNow() {
    setIsSending(true);
    try {
      const id = await persist(form.state.values);
      if (!id) {
        return;
      }
      const result = await sendAnnouncement(id);
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Failed to send announcement"
        );
        return;
      }
      toast.success(
        result.data?.status === "scheduled"
          ? "Announcement scheduled"
          : "Announcement sent"
      );
      router.push("/communications");
    } finally {
      setIsSending(false);
    }
  }

  const campusOptions = [
    ...(allowGlobalCampus
      ? [{ value: "", label: "All campuses (app-wide)" }]
      : []),
    ...campuses.map((campus) => ({ value: campus.id, label: campus.name })),
  ];

  return (
    <div className="pb-12">
      <EditorHeader
        backHref="/communications"
        backLabel="Communications"
        status={isNew ? undefined : announcement?.status}
        title={isNew ? "New announcement" : (announcement?.title_en ?? "Edit")}
      >
        <PortalButton
          loading={isSaving}
          onClick={handleSaveDraft}
          size="sm"
          variant="secondary"
        >
          Save draft
        </PortalButton>
        <PortalButton
          loading={isSending}
          onClick={handleSendNow}
          size="sm"
          variant="primary"
        >
          Send now
        </PortalButton>
      </EditorHeader>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="title_en">
              {(field) => (
                <PortalField label="Title (English)" required>
                  <PortalInput
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Push title in English"
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="title_no">
              {(field) => (
                <PortalField label="Title (Norwegian)">
                  <PortalInput
                    onChange={(e) => field.handleChange(e.target.value || null)}
                    placeholder="Push title in Norwegian"
                    value={field.state.value ?? ""}
                  />
                </PortalField>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="body_en">
              {(field) => (
                <PortalField label="Body (English)">
                  <PortalTextarea
                    onChange={(e) => field.handleChange(e.target.value || null)}
                    placeholder="Message body in English"
                    rows={4}
                    value={field.state.value ?? ""}
                  />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="body_no">
              {(field) => (
                <PortalField label="Body (Norwegian)">
                  <PortalTextarea
                    onChange={(e) => field.handleChange(e.target.value || null)}
                    placeholder="Message body in Norwegian"
                    rows={4}
                    value={field.state.value ?? ""}
                  />
                </PortalField>
              )}
            </form.Field>
          </div>

          <form.Field name="event_id">
            {(field) => (
              <PortalField
                hint="Attach an event id to deep-link the push to that event."
                label="Event id (optional)"
              >
                <PortalInput
                  className="font-mono text-xs"
                  onChange={(e) => field.handleChange(e.target.value || null)}
                  placeholder="e.g. 64f0c1a2b3..."
                  value={field.state.value ?? ""}
                />
              </PortalField>
            )}
          </form.Field>
        </div>

        <div className="space-y-5 self-start lg:sticky lg:top-32">
          <form.Field name="category">
            {(field) => (
              <PortalField label="Category">
                <PortalSelect
                  onChange={(e) =>
                    field.handleChange(
                      e.target.value as AnnouncementFormValues["category"]
                    )
                  }
                  options={CATEGORY_OPTIONS}
                  value={field.state.value}
                />
              </PortalField>
            )}
          </form.Field>

          <form.Field name="audience_type">
            {(field) => (
              <PortalField label="Audience">
                <PortalSelect
                  onChange={(e) =>
                    field.handleChange(
                      e.target.value as AnnouncementFormValues["audience_type"]
                    )
                  }
                  options={AUDIENCE_OPTIONS}
                  value={field.state.value}
                />
              </PortalField>
            )}
          </form.Field>

          <form.Subscribe selector={(state) => state.values.audience_type}>
            {(audienceType) => {
              if (audienceType === "topic") {
                return (
                  <form.Field name="audience_value">
                    {(field) => (
                      <PortalField label="Topic">
                        <PortalSelect
                          onChange={(e) => field.handleChange(e.target.value)}
                          options={TOPIC_OPTIONS}
                          value={field.state.value || "events"}
                        />
                      </PortalField>
                    )}
                  </form.Field>
                );
              }
              if (audienceType === "users") {
                return (
                  <form.Field name="audience_value">
                    {(field) => (
                      <PortalField
                        hint="Comma-separated user ids or emails. Emails are resolved on save."
                        label="Recipients"
                      >
                        <PortalTextarea
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="user1@bi.no, 64f0..."
                          rows={3}
                          value={field.state.value ?? ""}
                        />
                      </PortalField>
                    )}
                  </form.Field>
                );
              }
              return (
                <p className="text-xs" style={{ color: STUDIO.ink4 }}>
                  Broadcast reaches every app user via the default app topic.
                </p>
              );
            }}
          </form.Subscribe>

          <form.Field name="campus_id">
            {(field) => (
              <PortalField label="Campus">
                <PortalSelect
                  onChange={(e) => field.handleChange(e.target.value || null)}
                  options={campusOptions}
                  value={field.state.value ?? ""}
                />
              </PortalField>
            )}
          </form.Field>

          <form.Field name="scheduled_at">
            {(field) => (
              <PortalField
                hint="Leave empty to send immediately."
                label="Schedule (optional)"
              >
                <PortalInput
                  onChange={(e) => field.handleChange(e.target.value || null)}
                  type="datetime-local"
                  value={field.state.value ?? ""}
                />
              </PortalField>
            )}
          </form.Field>

          <form.Field name="push">
            {(field) => (
              <label
                className="flex items-center gap-2 text-sm"
                style={{ color: STUDIO.ink2 }}
              >
                <input
                  checked={field.state.value}
                  onChange={(e) => field.handleChange(e.target.checked)}
                  type="checkbox"
                />
                Send push notification
              </label>
            )}
          </form.Field>
        </div>
      </div>
    </div>
  );
}

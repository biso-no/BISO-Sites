"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createNews, updateNews } from "../../../_actions/news";
import { newsSchema, type NewsFormValues } from "../../../_actions/schemas";
import { EditorHeader } from "../../../_components/editor-header";
import { PreviewPanel } from "../../../_components/preview-panel";
import { PortalField, PortalInput, PortalSelect } from "../../../_components/portal-fields";
import { ImageUploadField } from "../../../_components/image-upload-field";
import { PortalButton } from "../../../_components/portal-button";
import { PortalBodyEditor } from "@repo/ui/components/portal-body-editor";
import type { News, ContentTranslations, Campus } from "@repo/api/types/appwrite";

type NewsWithTranslations = News & { translation_refs: ContentTranslations[] };

type NewsEditorClientProps = {
  article: NewsWithTranslations | null;
  campuses: Campus[];
  isNew: boolean;
  labels: Record<string, string>;
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
];
const LOCALE_OPTIONS = [
  { value: "no", label: "Norwegian" },
  { value: "en", label: "English" },
];
const CATEGORY_OPTIONS = [
  { value: "", label: "— Category —" },
  { value: "general", label: "General" },
  { value: "announcement", label: "Announcement" },
  { value: "press", label: "Press" },
  { value: "event", label: "Event Recap" },
];

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function NewsEditorClient({ article, campuses, isNew, labels }: NewsEditorClientProps) {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const translation = article?.translation_refs[0];
  let category: string | null = null;
  if (translation?.additional_fields) {
    try {
      category = JSON.parse(translation.additional_fields).category ?? null;
    } catch {
      // ignore
    }
  }

  const [previewTitle, setPreviewTitle] = useState(translation?.title ?? "");
  const [previewAuthor, setPreviewAuthor] = useState(article?.author ?? "");
  const [previewImage, setPreviewImage] = useState(article?.image ?? "");

  const form = useForm({
    defaultValues: {
      title: translation?.title ?? "",
      description: translation?.description ?? null,
      campus_id: article?.campus_id ?? (campuses[0]?.$id ?? ""),
      department_id: article?.department_id ?? null,
      slug: article?.slug ?? "",
      status: (article?.status as NewsFormValues["status"]) ?? "draft",
      locale: (translation?.locale as NewsFormValues["locale"]) ?? "no",
      author: article?.author ?? null,
      category: category,
      image: article?.image ?? null,
      sticky: article?.sticky ?? false,
    },
    onSubmit: async ({ value }) => {
      const validated = newsSchema.safeParse(value);
      if (!validated.success) {
        toast.error(labels.saveError);
        return;
      }
      const result = isNew
        ? await createNews(validated.data)
        : await updateNews(article!.$id, validated.data);
      if (result.error) {
        toast.error(labels.saveError);
        return;
      }
      toast.success(isPublishing ? labels.publishSuccess : labels.saveSuccess);
      if (isNew && result.data) router.push(`/admin/news/${result.data}`);
    },
  });

  const campusOptions = [
    { value: "", label: "— Select campus —" },
    ...campuses.map((c) => ({ value: c.$id, label: c.name })),
  ];

  return (
    <div className="pb-12">
      <EditorHeader
        backHref="/admin/news"
        backLabel={labels.back}
        title={isNew ? "New Article" : (translation?.title ?? "Edit Article")}
        status={isNew ? undefined : article?.status}
      >
        <PortalButton variant="ghost" size="sm" onClick={() => router.push("/admin/news")}>
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        <div className="space-y-5">
          {/* Headline */}
          <form.Field name="title">
            {(field) => (
              <PortalField label={labels.title} required>
                <textarea
                  rows={2}
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
                  placeholder="Headline goes here..."
                  className="w-full px-3 py-2.5 text-xl font-light resize-none rounded-xl outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#fff",
                    fontFamily: "serif",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "rgba(61,169,224,0.50)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                  }}
                />
              </PortalField>
            )}
          </form.Field>

          {/* Author / Category / Locale */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <form.Field name="author">
              {(field) => (
                <PortalField label={labels.author}>
                  <PortalInput
                    value={field.state.value ?? ""}
                    onChange={(e) => {
                      field.handleChange(e.target.value || null);
                      setPreviewAuthor(e.target.value);
                    }}
                    placeholder="Author name..."
                  />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="category">
              {(field) => (
                <PortalField label={labels.category}>
                  <PortalSelect
                    value={field.state.value ?? ""}
                    onChange={(e) => field.handleChange(e.target.value || null)}
                    options={CATEGORY_OPTIONS}
                  />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="locale">
              {(field) => (
                <PortalField label={labels.locale}>
                  <PortalSelect
                    value={field.state.value}
                    onChange={(e) =>
                      field.handleChange(e.target.value as "no" | "en")
                    }
                    options={LOCALE_OPTIONS}
                  />
                </PortalField>
              )}
            </form.Field>
          </div>

          {/* Cover image */}
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

          {/* Body (rich text) */}
          <form.Field name="description">
            {(field) => (
              <PortalField label={labels.body}>
                <PortalBodyEditor
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v || null)}
                  placeholder="Write your article here..."
                  minHeight={320}
                />
              </PortalField>
            )}
          </form.Field>

          {/* Campus / Status / Slug */}
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
                <PortalField label={labels.slug ?? "Slug"} required>
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

          <form.Field name="status">
            {(field) => (
              <PortalField label={labels.status}>
                <PortalSelect
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange(e.target.value as "draft" | "published")
                  }
                  options={STATUS_OPTIONS}
                />
              </PortalField>
            )}
          </form.Field>
        </div>

        {/* Preview */}
        <div className="lg:sticky lg:top-32 self-start">
          <PreviewPanel title={labels.preview}>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {previewImage && (
                <img src={previewImage} alt="" className="w-full h-28 object-cover" />
              )}
              <div className="p-4">
                <p
                  className="font-medium text-sm leading-snug"
                  style={{ color: "#fff", fontFamily: "serif" }}
                >
                  {previewTitle || "Article Headline"}
                </p>
                <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.40)" }}>
                  {previewAuthor || "Author"} · {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
          </PreviewPanel>
        </div>
      </div>
    </div>
  );
}

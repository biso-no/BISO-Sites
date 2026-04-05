"use client";

import type {
  Campus,
  ContentTranslations,
  News,
} from "@repo/api/types/appwrite";
import { ContentEditor } from "@repo/ui/components/content-editor";
import { useForm } from "@tanstack/react-form";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createNews, updateNews } from "../../../_actions/news";
import { type NewsFormValues, newsSchema } from "../../../_actions/schemas";
import { EditorHeader } from "../../../_components/editor-header";
import { ImageUploadField } from "../../../_components/image-upload-field";
import { PortalButton } from "../../../_components/portal-button";
import {
  PortalField,
  PortalInput,
  PortalSelect,
} from "../../../_components/portal-fields";
import { PreviewPanel } from "../../../_components/preview-panel";

type NewsWithTranslations = News & { translation_refs: ContentTranslations[] };

interface NewsEditorClientProps {
  article: NewsWithTranslations | null;
  campuses: Campus[];
  isNew: boolean;
  labels: Record<string, string>;
}

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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: component manages form state, preview sync, and conditional submit
export function NewsEditorClient({
  article,
  campuses,
  isNew,
  labels,
}: NewsEditorClientProps) {
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

  async function handleFormSubmit(value: NewsFormValues) {
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
    if (isNew && result.data) {
      router.push(`/admin/news/${result.data}`);
    }
  }

  const form = useForm({
    defaultValues: {
      title: translation?.title ?? "",
      description: translation?.description ?? null,
      campus_id: article?.campus_id ?? campuses[0]?.$id ?? "",
      department_id: article?.department_id ?? null,
      slug: article?.slug ?? "",
      status: (article?.status as NewsFormValues["status"]) ?? "draft",
      locale: (translation?.locale as NewsFormValues["locale"]) ?? "no",
      author: article?.author ?? null,
      category,
      image: article?.image ?? null,
      sticky: article?.sticky ?? false,
    },
    onSubmit: async ({ value }) => handleFormSubmit(value),
  });

  const campusOptions = [
    { value: "", label: "— Select campus —" },
    ...campuses.map((c) => ({ value: c.$id, label: c.name })),
  ];

  return (
    <div className="pb-12">
      <EditorHeader
        backHref="/news"
        backLabel={labels.back}
        status={isNew ? undefined : article?.status}
        title={isNew ? "New Article" : (translation?.title ?? "Edit Article")}
      >
        <PortalButton
          onClick={() => router.push("/news")}
          size="sm"
          variant="ghost"
        >
          {labels.discard}
        </PortalButton>
        <PortalButton
          loading={isSaving}
          onClick={() => {
            setIsSaving(true);
            form.setFieldValue("status", "draft");
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
            form.setFieldValue("status", "published");
            form.handleSubmit().finally(() => setIsPublishing(false));
          }}
          size="sm"
          variant="primary"
        >
          {labels.publish}
        </PortalButton>
      </EditorHeader>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          {/* Headline */}
          <form.Field name="title">
            {(field) => (
              <PortalField label={labels.title} required>
                <textarea
                  className="w-full resize-none rounded-xl px-3 py-2.5 font-light text-xl outline-none transition-all"
                  onBlur={(e) => {
                    field.handleBlur();
                    if (isNew && !form.getFieldValue("slug")) {
                      form.setFieldValue(
                        "slug",
                        generateSlug(field.state.value)
                      );
                    }
                    e.currentTarget.style.borderColor =
                      "rgba(255,255,255,0.08)";
                  }}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    setPreviewTitle(e.target.value);
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "rgba(61,169,224,0.50)";
                  }}
                  placeholder="Headline goes here..."
                  rows={2}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#fff",
                    fontFamily: "serif",
                  }}
                  value={field.state.value}
                />
              </PortalField>
            )}
          </form.Field>

          {/* Author / Category / Locale */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <form.Field name="author">
              {(field) => (
                <PortalField label={labels.author}>
                  <PortalInput
                    onChange={(e) => {
                      field.handleChange(e.target.value || null);
                      setPreviewAuthor(e.target.value);
                    }}
                    placeholder="Author name..."
                    value={field.state.value ?? ""}
                  />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="category">
              {(field) => (
                <PortalField label={labels.category}>
                  <PortalSelect
                    onChange={(e) => field.handleChange(e.target.value || null)}
                    options={CATEGORY_OPTIONS}
                    value={field.state.value ?? ""}
                  />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="locale">
              {(field) => (
                <PortalField label={labels.locale}>
                  <PortalSelect
                    onChange={(e) =>
                      field.handleChange(e.target.value as "no" | "en")
                    }
                    options={LOCALE_OPTIONS}
                    value={field.state.value}
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
                  onChange={(url) => {
                    field.handleChange(url);
                    setPreviewImage(url ?? "");
                  }}
                  value={field.state.value}
                />
              </PortalField>
            )}
          </form.Field>

          {/* Body (rich text) */}
          <form.Field name="description">
            {(field) => (
              <PortalField label={labels.body}>
                <ContentEditor
                  minHeight={320}
                  onChange={(v) => field.handleChange(v || null)}
                  placeholder="Write your article here..."
                  value={field.state.value}
                  variant="news"
                />
              </PortalField>
            )}
          </form.Field>

          {/* Campus / Status / Slug */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="campus_id">
              {(field) => (
                <PortalField label={labels.campus} required>
                  <PortalSelect
                    onChange={(e) => field.handleChange(e.target.value)}
                    options={campusOptions}
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="slug">
              {(field) => (
                <PortalField label={labels.slug ?? "Slug"} required>
                  <PortalInput
                    className="font-mono text-xs"
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>
          </div>

          <form.Field name="status">
            {(field) => (
              <PortalField label={labels.status}>
                <PortalSelect
                  onChange={(e) =>
                    field.handleChange(e.target.value as "draft" | "published")
                  }
                  options={STATUS_OPTIONS}
                  value={field.state.value}
                />
              </PortalField>
            )}
          </form.Field>
        </div>

        {/* Preview */}
        <div className="self-start lg:sticky lg:top-32">
          <PreviewPanel title={labels.preview}>
            <div
              className="overflow-hidden rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {previewImage && (
                <div className="relative h-28 w-full overflow-hidden">
                  <Image
                    alt=""
                    className="object-cover"
                    fill
                    src={previewImage}
                  />
                </div>
              )}
              <div className="p-4">
                <p
                  className="font-medium text-sm leading-snug"
                  style={{ color: "#fff", fontFamily: "serif" }}
                >
                  {previewTitle || "Article Headline"}
                </p>
                <p
                  className="mt-2 text-xs"
                  style={{ color: "rgba(255,255,255,0.40)" }}
                >
                  {previewAuthor || "Author"} ·{" "}
                  {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
          </PreviewPanel>
        </div>
      </div>
    </div>
  );
}

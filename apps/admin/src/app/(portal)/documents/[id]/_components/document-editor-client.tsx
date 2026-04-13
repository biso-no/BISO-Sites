"use client";

import type { Campus, Documents } from "@repo/api/types/appwrite";
import { useForm } from "@tanstack/react-form";
import { ExternalLink, FileText, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  DOCUMENT_FORM_CATEGORIES,
  type DocumentMetadataFormValues,
  documentMetadataSchema,
} from "@/app/(portal)/_actions/schemas";
import {
  createDocument,
  updateDocumentMetadata,
  uploadNewVersion,
} from "../../../_actions/documents";
import { EditorHeader } from "../../../_components/editor-header";
import { PdfUploadField } from "../../../_components/pdf-upload-field";
import { PortalButton } from "../../../_components/portal-button";
import {
  PortalField,
  PortalInput,
  PortalSelect,
  PortalTextarea,
} from "../../../_components/portal-fields";

interface DocumentEditorClientProps {
  campuses: Campus[];
  document: Documents | null;
  isNew: boolean;
  labels: Record<string, string>;
}

const SCOPE_OPTIONS = [
  { value: "national", label: "National (shown to all campuses)" },
  { value: "campus", label: "Campus-specific" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
];

function formatBytes(bytes: number | null): string {
  if (!bytes) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentEditorClient({
  campuses,
  document,
  isNew,
  labels,
}: DocumentEditorClientProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  // File state for new document creation
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Version upload state (for existing documents)
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [isVersionUploading, startVersionTransition] = useTransition();

  const categoryOptions = DOCUMENT_FORM_CATEGORIES.map((value) => ({
    value,
    label: labels[`category_${value}`] ?? value,
  }));

  const languageOptions = [
    { value: "no", label: labels.languageNo },
    { value: "en", label: labels.languageEn },
  ];

  const form = useForm({
    defaultValues: {
      title: document?.title ?? "",
      description: document?.description ?? "",
      category:
        (document?.category as DocumentMetadataFormValues["category"]) ??
        "national-statutes",
      scope:
        (document?.scope as DocumentMetadataFormValues["scope"]) ?? "national",
      campus_id: document?.campus_id ?? "",
      language: (document?.language ??
        "no") as DocumentMetadataFormValues["language"],
      version: document?.version ?? "",
      version_number: document?.version_number ?? 1,
      status:
        (document?.status as DocumentMetadataFormValues["status"]) ?? "draft",
      sort_order: document?.sort_order ?? 0,
    },
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: form submit handles new/edit + SP error paths
    onSubmit: async ({ value }) => {
      const validated = documentMetadataSchema.safeParse(value);
      if (!validated.success) {
        toast.error(labels.saveError);
        return;
      }

      setIsSaving(true);
      try {
        if (isNew) {
          if (!selectedFile) {
            toast.error("A PDF file is required");
            return;
          }

          const formData = new FormData();
          formData.append("file", selectedFile);

          const result = await createDocument(
            {
              ...validated.data,
              campus_id:
                validated.data.scope === "national"
                  ? null
                  : validated.data.campus_id || null,
            },
            formData
          );

          if (result.error) {
            if (result.sharePointError) {
              toast.error(`${labels.sharepointError}: ${result.error}`, {
                duration: 8000,
              });
            } else {
              toast.error(result.error);
            }
            return;
          }
          toast.success(labels.saveSuccess);
          router.push(`/documents/${result.data}`);
        } else {
          const result = await updateDocumentMetadata(document!.$id, {
            ...validated.data,
            campus_id:
              validated.data.scope === "national"
                ? null
                : validated.data.campus_id || null,
          });
          if ("error" in result) {
            toast.error(result.error);
            return;
          }
          toast.success(labels.saveSuccess);
        }
      } finally {
        setIsSaving(false);
      }
    },
  });

  function handleVersionUpload() {
    if (!(versionFile && document)) {
      return;
    }
    startVersionTransition(async () => {
      const formData = new FormData();
      formData.append("file", versionFile);
      const result = await uploadNewVersion(document.$id, formData);
      if (result.error) {
        if (result.sharePointError) {
          toast.error(`${labels.sharepointError}: ${result.error}`, {
            duration: 8000,
          });
        } else {
          toast.error(result.error);
        }
        return;
      }
      toast.success(
        `${labels.uploadSuccess} — v${"newVersionNumber" in result ? result.newVersionNumber : ""}`
      );
      setVersionFile(null);
    });
  }

  const campusOptions = [
    { value: "", label: "— Select campus —" },
    ...campuses.map((c) => ({ value: c.$id, label: c.name })),
  ];

  return (
    <div className="pb-12">
      <EditorHeader
        backHref="/documents"
        backLabel={labels.back}
        title={isNew ? "New Document" : (document?.title ?? "Edit Document")}
      >
        <PortalButton
          disabled={isSaving}
          onClick={() => form.handleSubmit()}
          style={{ background: "rgba(255,255,255,0.06)", color: "#fff" }}
          type="button"
        >
          {labels.discard}
        </PortalButton>
        <PortalButton
          disabled={isSaving}
          onClick={() => form.handleSubmit()}
          style={{ background: "#3DA9E0", color: "#001731" }}
          type="button"
        >
          {isSaving ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            labels.save
          )}
        </PortalButton>
      </EditorHeader>

      <div className="mx-auto max-w-2xl space-y-6 px-6 pt-8">
        {/* Document details */}
        <section
          className="space-y-5 rounded-2xl p-6"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <h2
            className="font-semibold text-sm"
            style={{ color: "rgba(255,255,255,0.60)" }}
          >
            Document details
          </h2>

          <form.Field name="title">
            {(field) => (
              <PortalField
                error={
                  field.state.meta.errors[0]
                    ? String(field.state.meta.errors[0])
                    : undefined
                }
                label={labels.title}
                required
              >
                <PortalInput
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="e.g. BISO Constitution"
                  value={field.state.value}
                />
              </PortalField>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <PortalField label={labels.description}>
                <PortalTextarea
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Short description of this document…"
                  rows={2}
                  value={field.state.value ?? ""}
                />
              </PortalField>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="category">
              {(field) => (
                <PortalField label={labels.category} required>
                  <PortalSelect
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                      field.handleChange(
                        e.target.value as DocumentMetadataFormValues["category"]
                      )
                    }
                    options={categoryOptions}
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>

            <form.Field name="language">
              {(field) => (
                <PortalField label={labels.language} required>
                  <PortalSelect
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                      field.handleChange(
                        e.target.value as DocumentMetadataFormValues["language"]
                      )
                    }
                    options={languageOptions}
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="scope">
              {(field) => (
                <PortalField label={labels.scope} required>
                  <PortalSelect
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                      field.handleChange(
                        e.target.value as DocumentMetadataFormValues["scope"]
                      )
                    }
                    options={SCOPE_OPTIONS}
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>

            <form.Subscribe selector={(state) => state.values.scope}>
              {(scope) =>
                scope === "campus" ? (
                  <form.Field name="campus_id">
                    {(field) => (
                      <PortalField label={labels.campus} required>
                        <PortalSelect
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          options={campusOptions}
                          value={field.state.value ?? ""}
                        />
                      </PortalField>
                    )}
                  </form.Field>
                ) : null
              }
            </form.Subscribe>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <form.Field name="version">
              {(field) => (
                <PortalField hint='e.g. "v2.1"' label={labels.version}>
                  <PortalInput
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="v1.0"
                    value={field.state.value ?? ""}
                  />
                </PortalField>
              )}
            </form.Field>

            <form.Field name="status">
              {(field) => (
                <PortalField label={labels.status} required>
                  <PortalSelect
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                      field.handleChange(
                        e.target.value as DocumentMetadataFormValues["status"]
                      )
                    }
                    options={STATUS_OPTIONS}
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>

            <form.Field name="sort_order">
              {(field) => (
                <PortalField label={labels.sortOrder}>
                  <PortalInput
                    min={0}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(Number(e.target.value))}
                    type="number"
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>
          </div>
        </section>

        {/* File section */}
        {isNew ? (
          <section
            className="space-y-5 rounded-2xl p-6"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <h2
              className="font-semibold text-sm"
              style={{ color: "rgba(255,255,255,0.60)" }}
            >
              File
            </h2>

            <PortalField label={labels.file} required>
              <PdfUploadField onChange={setSelectedFile} value={selectedFile} />
            </PortalField>
          </section>
        ) : (
          document && (
            <section
              className="space-y-5 rounded-2xl p-6"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <h2
                className="font-semibold text-sm"
                style={{ color: "rgba(255,255,255,0.60)" }}
              >
                File on SharePoint
              </h2>

              {/* Current file info */}
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <FileText size={18} style={{ color: "#3DA9E0" }} />
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm"
                    style={{ color: "rgba(255,255,255,0.70)" }}
                  >
                    Version {document.version_number}
                    {document.version ? ` — ${document.version}` : ""}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "rgba(255,255,255,0.30)" }}
                  >
                    {formatBytes(document.file_size)} · Last updated{" "}
                    {new Date(document.$updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <a
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors"
                  href={document.sharepoint_web_url}
                  rel="noopener noreferrer"
                  style={{
                    background: "rgba(61,169,224,0.10)",
                    color: "#3DA9E0",
                    border: "1px solid rgba(61,169,224,0.20)",
                  }}
                  target="_blank"
                >
                  <ExternalLink size={12} />
                  {labels.viewOnSharePoint}
                </a>
              </div>

              {/* Upload new version */}
              <div className="space-y-3">
                <p
                  className="text-xs"
                  style={{ color: "rgba(255,255,255,0.30)" }}
                >
                  {labels.versionUploadHint}
                </p>
                <PdfUploadField onChange={setVersionFile} value={versionFile} />
                {versionFile && (
                  <PortalButton
                    disabled={isVersionUploading}
                    onClick={handleVersionUpload}
                    style={{ background: "#3DA9E0", color: "#001731" }}
                    type="button"
                  >
                    {isVersionUploading ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <>
                        <Upload size={14} />
                        {labels.uploadVersion}
                      </>
                    )}
                  </PortalButton>
                )}
              </div>
            </section>
          )
        )}
      </div>
    </div>
  );
}

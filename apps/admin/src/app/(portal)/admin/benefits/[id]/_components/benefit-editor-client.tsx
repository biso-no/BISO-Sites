"use client";

import type { Campus, CampusBenefits } from "@repo/api/types/appwrite";
import { ContentEditor } from "@repo/ui/components/content-editor";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  type BenefitFormValues,
  benefitSchema,
} from "@/app/(portal)/admin/_actions/schemas";
import { createBenefit, updateBenefit } from "../../../_actions/benefits";
import { EditorHeader } from "../../../_components/editor-header";
import { ImageUploadField } from "../../../_components/image-upload-field";
import { PortalButton } from "../../../_components/portal-button";
import {
  PortalField,
  PortalInput,
  PortalSelect,
} from "../../../_components/portal-fields";
import { PreviewPanel } from "../../../_components/preview-panel";

interface BenefitEditorClientProps {
  benefit: CampusBenefits | null;
  campuses: Campus[];
  isNew: boolean;
  labels: Record<string, string>;
}

const KIND_OPTIONS = [
  { value: "offer", label: "Offer" },
  { value: "perk", label: "Perk" },
  { value: "service", label: "Service" },
];
const REDEMPTION_OPTIONS = [
  { value: "none", label: "None" },
  { value: "code", label: "Promo Code" },
  { value: "link", label: "Link" },
  { value: "qr", label: "QR Code" },
  { value: "onsite", label: "On-site" },
];
const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];
const CATEGORY_OPTIONS = [
  { value: "", label: "— Category —" },
  ...["Career", "Lifestyle", "Education", "Health", "Finance", "Other"].map(
    (c) => ({ value: c, label: c })
  ),
];

export function BenefitEditorClient({
  benefit,
  campuses,
  isNew,
  labels,
}: BenefitEditorClientProps) {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Preview state
  const [previewTitle, setPreviewTitle] = useState(benefit?.title_en ?? "");
  const [previewKind, setPreviewKind] = useState<string>(
    benefit?.kind ?? "offer"
  );
  const [previewPartner, setPreviewPartner] = useState(
    benefit?.partner_name ?? ""
  );
  const [previewImage, setPreviewImage] = useState(benefit?.image_url ?? "");
  const [previewRedemption, setPreviewRedemption] = useState<string>(
    benefit?.redemption_type ?? "none"
  );

  const form = useForm({
    defaultValues: {
      title_nb: benefit?.title_nb ?? "",
      title_en: benefit?.title_en ?? "",
      description_nb: benefit?.description_nb ?? "",
      description_en: benefit?.description_en ?? "",
      teaser_nb: benefit?.teaser_nb ?? null,
      teaser_en: benefit?.teaser_en ?? null,
      campus_id: benefit?.campus_id ?? campuses[0]?.$id ?? "",
      status: (benefit?.status as BenefitFormValues["status"]) ?? "draft",
      kind: (benefit?.kind as BenefitFormValues["kind"]) ?? "offer",
      redemption_type:
        (benefit?.redemption_type as BenefitFormValues["redemption_type"]) ??
        "none",
      redemption_value: benefit?.redemption_value ?? null,
      category: benefit?.category ?? "Career",
      partner_name: benefit?.partner_name ?? null,
      image_url: benefit?.image_url ?? null,
      is_featured: benefit?.is_featured ?? false,
      is_member_only: benefit?.is_member_only ?? true,
      publish_start: benefit?.publish_start ?? null,
      publish_end: benefit?.publish_end ?? null,
      sort_order: benefit?.sort_order ?? 0,
    },
    onSubmit: async ({ value }) => {
      const validated = benefitSchema.safeParse(value);
      if (!validated.success) {
        toast.error(labels.saveError);
        return;
      }
      const result = isNew
        ? await createBenefit(validated.data)
        : await updateBenefit(benefit!.$id, validated.data);
      if (result.error) {
        toast.error(labels.saveError);
        return;
      }
      toast.success(isPublishing ? labels.publishSuccess : labels.saveSuccess);
      if (isNew && result.data) {
        router.push(`/admin/benefits/${result.data}`);
      }
    },
  });

  const campusOptions = [
    { value: "", label: "— Select campus —" },
    ...campuses.map((c) => ({ value: c.$id, label: c.name })),
  ];

  return (
    <div className="pb-12">
      <EditorHeader
        backHref="/admin/benefits"
        backLabel={labels.back}
        status={isNew ? undefined : benefit?.status}
        title={isNew ? "New Benefit" : (benefit?.title_en ?? "Edit Benefit")}
      >
        <PortalButton
          onClick={() => router.push("/admin/benefits")}
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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="title_nb">
              {(field) => (
                <PortalField label={labels.titleNo} required>
                  <PortalInput
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="title_en">
              {(field) => (
                <PortalField label={labels.titleEn} required>
                  <PortalInput
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                      setPreviewTitle(e.target.value);
                    }}
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>
          </div>

          <form.Field name="description_nb">
            {(field) => (
              <PortalField label={labels.descriptionNo} required>
                <ContentEditor
                  minHeight={180}
                  onChange={(v) => field.handleChange(v)}
                  placeholder="Beskrivelse på norsk..."
                  value={field.state.value}
                  variant="base"
                />
              </PortalField>
            )}
          </form.Field>
          <form.Field name="description_en">
            {(field) => (
              <PortalField label={labels.descriptionEn} required>
                <ContentEditor
                  minHeight={180}
                  onChange={(v) => field.handleChange(v)}
                  placeholder="Description in English..."
                  value={field.state.value}
                  variant="base"
                />
              </PortalField>
            )}
          </form.Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <form.Field name="kind">
              {(field) => (
                <PortalField label={labels.kind}>
                  <PortalSelect
                    onChange={(e) => {
                      field.handleChange(
                        e.target.value as BenefitFormValues["kind"]
                      );
                      setPreviewKind(e.target.value);
                    }}
                    options={KIND_OPTIONS}
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="redemption_type">
              {(field) => (
                <PortalField label={labels.redemptionType}>
                  <PortalSelect
                    onChange={(e) => {
                      field.handleChange(
                        e.target.value as BenefitFormValues["redemption_type"]
                      );
                      setPreviewRedemption(e.target.value);
                    }}
                    options={REDEMPTION_OPTIONS}
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="category">
              {(field) => (
                <PortalField label={labels.category}>
                  <PortalSelect
                    onChange={(e) => field.handleChange(e.target.value)}
                    options={CATEGORY_OPTIONS}
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form.Field name="partner_name">
              {(field) => (
                <PortalField label={labels.partnerName}>
                  <PortalInput
                    onChange={(e) => {
                      field.handleChange(e.target.value || null);
                      setPreviewPartner(e.target.value);
                    }}
                    placeholder="Partner name..."
                    value={field.state.value ?? ""}
                  />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="redemption_value">
              {(field) => (
                <PortalField label={labels.redemptionValue}>
                  <PortalInput
                    onChange={(e) => field.handleChange(e.target.value || null)}
                    placeholder="Code / URL..."
                    value={field.state.value ?? ""}
                  />
                </PortalField>
              )}
            </form.Field>
          </div>

          <form.Field name="image_url">
            {(field) => (
              <PortalField label={labels.imageUrl}>
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
            <form.Field name="status">
              {(field) => (
                <PortalField label={labels.status}>
                  <PortalSelect
                    onChange={(e) =>
                      field.handleChange(
                        e.target.value as BenefitFormValues["status"]
                      )
                    }
                    options={STATUS_OPTIONS}
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>
          </div>
        </div>

        <div className="self-start lg:sticky lg:top-32">
          <PreviewPanel title={labels.preview}>
            <div
              className="mx-auto w-48 overflow-hidden rounded-3xl"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                className="h-24"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(61,169,224,0.15), rgba(0,23,49,0.80))",
                }}
              >
                {previewImage && (
                  <img
                    alt=""
                    className="h-full w-full object-cover opacity-60"
                    src={previewImage}
                  />
                )}
              </div>
              <div className="p-3">
                {previewPartner && (
                  <p
                    className="text-[9px] uppercase tracking-widest"
                    style={{ color: "#3DA9E0" }}
                  >
                    {previewPartner}
                  </p>
                )}
                <p
                  className="mt-1 font-semibold text-xs leading-snug"
                  style={{ color: "#fff" }}
                >
                  {previewTitle || "Benefit Title"}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span
                    className="text-[9px] uppercase tracking-wide"
                    style={{ color: "rgba(255,255,255,0.40)" }}
                  >
                    {previewKind}
                  </span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px]"
                    style={{
                      background: "rgba(61,169,224,0.20)",
                      color: "#3DA9E0",
                    }}
                  >
                    {previewRedemption}
                  </span>
                </div>
              </div>
            </div>
          </PreviewPanel>
        </div>
      </div>
    </div>
  );
}

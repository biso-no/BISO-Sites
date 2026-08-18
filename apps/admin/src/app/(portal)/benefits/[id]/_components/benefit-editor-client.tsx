"use client";

import type {
  Campus,
  CampusBenefits,
  Departments,
} from "@repo/api/types/appwrite";
import { useForm } from "@tanstack/react-form";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AutoTranslateControl,
  TranslationReviewCard,
} from "@/app/_components/content-translation-controls";
import {
  type BenefitFormValues,
  benefitSchema,
} from "@/app/(portal)/_actions/schemas";
import { type ContentLocale, getTargetLocale } from "@/lib/content-translation";
import {
  createBenefit,
  generateBenefitTranslationDraft,
  updateBenefit,
} from "../../../_actions/benefits";
import { DepartmentCombobox } from "../../../_components/department-combobox";
import { DescriptionBlockEditor } from "../../../_components/description-block-editor";
import { EditorHeader } from "../../../_components/editor-header";
import { ImageUploadField } from "../../../_components/image-upload-field";
import { PortalButton } from "../../../_components/portal-button";
import {
  PortalField,
  PortalInput,
  PortalSelect,
} from "../../../_components/portal-fields";
import { PreviewPanel } from "../../../_components/preview-panel";
import {
  SERIF_STACK,
  STUDIO,
  studioSurface,
} from "../../../_components/studio";

interface BenefitEditorClientProps {
  benefit: CampusBenefits | null;
  campuses: Campus[];
  initialDepartmentId: string | null;
  initialDepartments: Departments[];
  isNew: boolean;
  labels: Record<string, string>;
  /** Single-department authors are pinned to their department. */
  lockDepartment: boolean;
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

interface BenefitEditorTranslationDraft {
  description: string;
  teaser: string;
  title: string;
}

const getBenefitEditorTranslationDraft = (
  values: BenefitFormValues,
  locale: ContentLocale
): BenefitEditorTranslationDraft =>
  locale === "no"
    ? {
        description: values.description_nb,
        teaser: values.teaser_nb ?? "",
        title: values.title_nb,
      }
    : {
        description: values.description_en,
        teaser: values.teaser_en ?? "",
        title: values.title_en,
      };

const hasBenefitTranslationContent = ({
  description,
  teaser,
  title,
}: BenefitEditorTranslationDraft): boolean =>
  Boolean(description.trim() || teaser.trim() || title.trim());

const getBenefitSaveMessage = ({
  published,
  queued,
  labels,
}: {
  published: boolean;
  queued: boolean;
  labels: BenefitEditorClientProps["labels"];
}): string => {
  if (queued) {
    return published
      ? "Benefit published; translation queued"
      : "Benefit saved; translation queued";
  }
  return published ? labels.publishSuccess : labels.saveSuccess;
};

function LocaleTabs({
  locale,
  pendingEn,
  pendingNo,
  setLocale,
}: {
  locale: ContentLocale;
  pendingEn: boolean;
  pendingNo: boolean;
  setLocale: (locale: ContentLocale) => void;
}) {
  return (
    <div
      className="inline-flex gap-0.5 rounded-lg p-1"
      style={{
        background: STUDIO.paper2,
        border: `0.5px solid ${STUDIO.rule2}`,
      }}
    >
      {(["no", "en"] as const).map((item) => {
        const active = locale === item;
        const pending = item === "no" ? pendingNo : pendingEn;
        return (
          <button
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-xs transition-colors"
            key={item}
            onClick={() => setLocale(item)}
            style={{
              background: active ? "white" : "transparent",
              boxShadow: active ? "0 1px 2px rgba(26,24,20,0.06)" : "none",
              color: active ? STUDIO.ink : STUDIO.ink3,
            }}
            type="button"
          >
            {item === "no" ? "Norsk" : "English"}
            {pending && (
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: STUDIO.gold }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: component manages form state, preview sync, and conditional submit
export function BenefitEditorClient({
  benefit,
  campuses,
  initialDepartmentId,
  initialDepartments,
  isNew,
  labels,
  lockDepartment,
}: BenefitEditorClientProps) {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [confirmTranslationOverwrite, setConfirmTranslationOverwrite] =
    useState(false);
  const [locale, setLocale] = useState<ContentLocale>(() =>
    benefit?.title_en || !benefit?.title_nb ? "en" : "no"
  );

  // Preview state
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

  async function handleFormSubmit(value: BenefitFormValues) {
    const validated = benefitSchema.safeParse(value);
    if (!validated.success) {
      toast.error(labels.saveError);
      return;
    }
    const result = isNew
      ? await createBenefit(validated.data, {
          enabled: autoTranslate,
          sourceLocale: locale,
        })
      : await updateBenefit(benefit!.$id, validated.data, {
          enabled: autoTranslate,
          sourceLocale: locale,
        });
    if (result.error) {
      toast.error(labels.saveError);
      return;
    }
    toast.success(
      getBenefitSaveMessage({
        labels,
        published: validated.data.status === "published",
        queued: result.translationQueued === true,
      })
    );
    if (isNew && result.data) {
      router.push(`/benefits/${result.data}`);
    }
  }

  const form = useForm({
    defaultValues: {
      title_nb: benefit?.title_nb ?? "",
      title_en: benefit?.title_en ?? "",
      description_nb: benefit?.description_nb ?? "",
      description_en: benefit?.description_en ?? "",
      teaser_nb: benefit?.teaser_nb ?? null,
      teaser_en: benefit?.teaser_en ?? null,
      campus_id: benefit?.campus_id ?? campuses[0]?.$id ?? "",
      department_id: initialDepartmentId,
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
    onSubmit: async ({ value }) => handleFormSubmit(value),
  });

  async function handleTranslate() {
    const values = form.state.values;
    const source = getBenefitEditorTranslationDraft(values, locale);
    const targetLocale = getTargetLocale(locale);
    const destination = getBenefitEditorTranslationDraft(values, targetLocale);
    if (
      hasBenefitTranslationContent(destination) &&
      !confirmTranslationOverwrite
    ) {
      setConfirmTranslationOverwrite(true);
      toast.warning("Click Generate again to replace the translated draft.");
      return;
    }

    setConfirmTranslationOverwrite(false);
    setIsTranslating(true);
    try {
      const result = await generateBenefitTranslationDraft({
        campusId: values.campus_id,
        departmentId: values.department_id ?? null,
        ...source,
        sourceLocale: locale,
      });
      if (result.error || !result.data) {
        toast.error(result.error ?? "Failed to generate benefit translation");
        return;
      }

      if (targetLocale === "en") {
        form.setFieldValue("title_en", result.data.title);
        form.setFieldValue("description_en", result.data.description);
        form.setFieldValue("teaser_en", result.data.teaser);
      } else {
        form.setFieldValue("title_nb", result.data.title);
        form.setFieldValue("description_nb", result.data.description);
        form.setFieldValue("teaser_nb", result.data.teaser);
      }
      setLocale(targetLocale);
      toast.success(
        targetLocale === "en"
          ? "English draft generated"
          : "Norwegian draft generated"
      );
    } finally {
      setIsTranslating(false);
    }
  }

  const campusOptions = [
    { value: "", label: "— Select campus —" },
    ...campuses.map((c) => ({ value: c.$id, label: c.name })),
  ];

  return (
    <div className="pb-12">
      <EditorHeader
        backHref="/benefits"
        backLabel={labels.back}
        status={isNew ? undefined : benefit?.status}
        title={isNew ? "New Benefit" : (benefit?.title_en ?? "Edit Benefit")}
      >
        <AutoTranslateControl
          checked={autoTranslate}
          className="max-w-xs"
          disabled={isSaving || isPublishing}
          onCheckedChange={setAutoTranslate}
          operation="save or publish"
          sourceLocale={locale}
        />
        <PortalButton
          onClick={() => router.push("/benefits")}
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
          <div className="space-y-1.5">
            <form.Subscribe
              selector={(state) => ({
                titleEn: state.values.title_en,
                titleNb: state.values.title_nb,
              })}
            >
              {({ titleEn, titleNb }) => (
                <LocaleTabs
                  locale={locale}
                  pendingEn={!titleEn.trim()}
                  pendingNo={!titleNb.trim()}
                  setLocale={setLocale}
                />
              )}
            </form.Subscribe>
            <p className="text-xs" style={{ color: STUDIO.ink4 }}>
              Complete either language, then use auto-translate to generate the
              other.
            </p>
          </div>

          <form.Field name={locale === "no" ? "title_nb" : "title_en"}>
            {(field) => (
              <PortalField
                label={locale === "no" ? labels.titleNo : labels.titleEn}
              >
                <PortalInput
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  value={field.state.value}
                />
              </PortalField>
            )}
          </form.Field>

          <form.Field
            name={locale === "no" ? "description_nb" : "description_en"}
          >
            {(field) => (
              <PortalField
                label={
                  locale === "no" ? labels.descriptionNo : labels.descriptionEn
                }
              >
                <DescriptionBlockEditor
                  onChange={(v) => field.handleChange(v)}
                  placeholder={
                    locale === "no"
                      ? "Beskrivelse på norsk..."
                      : "Description in English..."
                  }
                  value={field.state.value}
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

          <form.Subscribe selector={(state) => state.values.campus_id}>
            {(campusId) => (
              <form.Field name="department_id">
                {(field) => (
                  <PortalField label={labels.department ?? "Department"}>
                    <DepartmentCombobox
                      campusId={campusId || null}
                      disabled={lockDepartment}
                      initialDepartments={initialDepartments}
                      onChange={(id) => field.handleChange(id)}
                      placeholder="Campus-wide (no department)"
                      value={field.state.value ?? null}
                    />
                  </PortalField>
                )}
              </form.Field>
            )}
          </form.Subscribe>

          <div className="space-y-3 pt-2">
            <TranslationReviewCard
              isTranslating={isTranslating}
              onTranslate={handleTranslate}
              sourceLocale={locale}
            />
            {confirmTranslationOverwrite && (
              <p className="text-amber-700 text-sm">
                The destination already has content. Click Generate again to
                replace it.
              </p>
            )}
          </div>
        </div>

        <div className="self-start lg:sticky lg:top-32">
          <PreviewPanel title={labels.preview}>
            <div
              className="mx-auto w-48 overflow-hidden rounded-3xl"
              style={studioSurface}
            >
              <div
                className="relative h-24 overflow-hidden"
                style={{
                  background: STUDIO.paper2,
                }}
              >
                {previewImage && (
                  <Image
                    alt=""
                    className="object-cover opacity-60"
                    fill
                    src={previewImage}
                  />
                )}
              </div>
              <div className="p-3">
                {previewPartner && (
                  <p
                    className="text-[9px] uppercase tracking-widest"
                    style={{ color: STUDIO.claret }}
                  >
                    {previewPartner}
                  </p>
                )}
                <form.Subscribe
                  selector={(state) =>
                    locale === "no"
                      ? state.values.title_nb
                      : state.values.title_en
                  }
                >
                  {(title) => (
                    <p
                      className="mt-1 text-lg leading-5"
                      style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
                    >
                      {title || "Benefit Title"}
                    </p>
                  )}
                </form.Subscribe>
                <div className="mt-2 flex items-center justify-between">
                  <span
                    className="text-[9px] uppercase tracking-wide"
                    style={{ color: STUDIO.ink4 }}
                  >
                    {previewKind}
                  </span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px]"
                    style={{
                      background: "rgba(107,30,30,0.10)",
                      color: STUDIO.claret,
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

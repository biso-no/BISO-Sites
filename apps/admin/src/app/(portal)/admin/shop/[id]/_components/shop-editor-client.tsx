"use client";

import type {
  Campus,
  ContentTranslations,
  WebshopProducts,
} from "@repo/api/types/appwrite";
import { ContentEditor } from "@repo/ui/components/content-editor";
import { useForm } from "@tanstack/react-form";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  type ProductFormValues,
  productSchema,
} from "../../../_actions/schemas";
import { createProduct, updateProduct } from "../../../_actions/shop";
import { EditorHeader } from "../../../_components/editor-header";
import { ImageUploadField } from "../../../_components/image-upload-field";
import { PortalButton } from "../../../_components/portal-button";
import {
  PortalField,
  PortalInput,
  PortalSelect,
} from "../../../_components/portal-fields";
import { PreviewPanel } from "../../../_components/preview-panel";

type ProductWithTranslations = WebshopProducts & {
  translation_refs: ContentTranslations[];
};

interface ShopEditorClientProps {
  campuses: Campus[];
  isNew: boolean;
  labels: Record<string, string>;
  product: ProductWithTranslations | null;
}

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "— Category —" },
  { value: "clothing", label: "Clothing" },
  { value: "accessories", label: "Accessories" },
  { value: "digital", label: "Digital" },
  { value: "other", label: "Other" },
];

function generateSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: component manages form state, preview sync, and conditional submit
export function ShopEditorClient({
  product,
  campuses,
  isNew,
  labels,
}: ShopEditorClientProps) {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const translation = product?.translation_refs[0];

  // Preview state
  const [previewName, setPreviewName] = useState(translation?.title ?? "");
  const [previewPrice, setPreviewPrice] = useState(product?.regular_price ?? 0);
  const [previewImage, setPreviewImage] = useState(product?.image ?? "");
  const [previewStock, setPreviewStock] = useState<number | null>(
    product?.stock ?? null
  );

  async function handleFormSubmit(value: ProductFormValues) {
    const validated = productSchema.safeParse(value);
    if (!validated.success) {
      toast.error(labels.saveError);
      return;
    }
    const result = isNew
      ? await createProduct(validated.data)
      : await updateProduct(product!.$id, validated.data);
    if (result.error) {
      toast.error(labels.saveError);
      return;
    }
    toast.success(isPublishing ? labels.publishSuccess : labels.saveSuccess);
    if (isNew && result.data) {
      router.push(`/admin/shop/${result.data}`);
    }
  }

  const form = useForm({
    defaultValues: {
      name: translation?.title ?? "",
      description: translation?.description ?? null,
      campus_id: product?.campus_id ?? campuses[0]?.$id ?? "",
      department_id: product?.departmentId ?? null,
      slug: product?.slug ?? "",
      status: (product?.status as ProductFormValues["status"]) ?? "draft",
      category: product?.category ?? null,
      regular_price: product?.regular_price ?? 0,
      member_price: product?.member_price ?? null,
      member_only: product?.member_only ?? false,
      image: product?.image ?? null,
      stock: product?.stock ?? null,
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
        backHref="/admin/shop"
        backLabel={labels.back}
        status={isNew ? undefined : product?.status}
        title={isNew ? "New Product" : (translation?.title ?? "Edit Product")}
      >
        <PortalButton
          onClick={() => router.push("/admin/shop")}
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
          <form.Field name="name">
            {(field) => (
              <PortalField label={labels.name} required>
                <PortalInput
                  onBlur={() => {
                    field.handleBlur();
                    if (isNew && !form.getFieldValue("slug")) {
                      form.setFieldValue(
                        "slug",
                        generateSlug(field.state.value)
                      );
                    }
                  }}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    setPreviewName(e.target.value);
                  }}
                  placeholder="Product name..."
                  value={field.state.value}
                />
              </PortalField>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <PortalField label={labels.description}>
                <ContentEditor
                  minHeight={180}
                  onChange={(v) => field.handleChange(v || null)}
                  placeholder="Product description..."
                  value={field.state.value}
                  variant="products"
                />
              </PortalField>
            )}
          </form.Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <form.Field name="regular_price">
              {(field) => (
                <PortalField label={labels.price} required>
                  <PortalInput
                    min="0"
                    onChange={(e) => {
                      field.handleChange(Number(e.target.value));
                      setPreviewPrice(Number(e.target.value));
                    }}
                    type="number"
                    value={field.state.value}
                  />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="member_price">
              {(field) => (
                <PortalField label={labels.memberPrice}>
                  <PortalInput
                    min="0"
                    onChange={(e) =>
                      field.handleChange(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    placeholder="Optional"
                    type="number"
                    value={field.state.value ?? ""}
                  />
                </PortalField>
              )}
            </form.Field>
            <form.Field name="stock">
              {(field) => (
                <PortalField label={labels.stock}>
                  <PortalInput
                    min="0"
                    onChange={(e) => {
                      field.handleChange(
                        e.target.value ? Number(e.target.value) : null
                      );
                      setPreviewStock(
                        e.target.value ? Number(e.target.value) : null
                      );
                    }}
                    placeholder="∞"
                    type="number"
                    value={field.state.value ?? ""}
                  />
                </PortalField>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          </div>

          <form.Field name="image">
            {(field) => (
              <PortalField label={labels.image}>
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
                        e.target.value as ProductFormValues["status"]
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
              className="overflow-hidden rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                className="relative h-40 overflow-hidden"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                {previewImage ? (
                  <Image
                    alt=""
                    className="object-cover"
                    fill
                    src={previewImage}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl">
                    🛍️
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="font-medium text-sm" style={{ color: "#fff" }}>
                  {previewName || "Product Name"}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <p
                    className="font-bold font-mono text-sm"
                    style={{ color: "#3DA9E0" }}
                  >
                    {previewPrice} NOK
                  </p>
                  {previewStock !== null && (
                    <p
                      className="text-xs"
                      style={{ color: "rgba(255,255,255,0.40)" }}
                    >
                      Stock: {previewStock}
                    </p>
                  )}
                </div>
                <button
                  className="mt-3 w-full rounded-xl py-2 font-medium text-xs"
                  style={{ background: "#3DA9E0", color: "#001731" }}
                  type="button"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </PreviewPanel>
        </div>
      </div>
    </div>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/components/ui/breadcrumb";
import { Button } from "@repo/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Switch } from "@repo/ui/components/ui/switch";
import {
  AlertCircle,
  Check,
  DollarSign,
  Edit2,
  Hash,
  Package,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type SubmitHandler,
  type UseFormReturn,
  useForm,
} from "react-hook-form";
import { z } from "zod";
import {
  createProduct,
  translateProductContent,
  updateProduct,
} from "@/app/actions/products";
import { CharacterCount } from "@/components/forms/CharacterCount";
import { DraftRestoreBanner } from "@/components/forms/DraftRestoreBanner";
import { FormSection } from "@/components/forms/FormSection";
import { LocaleTabGroup } from "@/components/forms/LocaleTabGroup";
import type { SaveStatus } from "@/components/forms/SaveBar";
import { SaveBar } from "@/components/forms/SaveBar";
import { slugify } from "@/components/forms/slugify";
import { ProductPreviewPane } from "@/components/preview/ProductPreviewPane";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useAutosave } from "@/hooks/useAutosave";
import { useDirtyWarning } from "@/hooks/useDirtyWarning";
import { toast } from "@/lib/hooks/use-toast";
import type { Campus } from "@/lib/types/post";
import type {
  CreateProductData,
  ProductMetadata,
  ProductTranslation,
  ProductWithTranslations,
  UpdateProductData,
} from "@/lib/types/product";
import { CustomFieldsEditor } from "./custom-fields-editor";
import ImageUploadCard from "./image-upload-card";
import { ToggleSection } from "./toggle-section";
import { VariationsEditor } from "./variations-editor";

// ── Schema ────────────────────────────────────────────────────────────────────

const customFieldSchema = z.object({
  id: z.string(),
  label: z.string().min(1, "Field label is required"),
  type: z.enum(["text", "textarea", "number", "select"]),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.string().min(1)).optional(),
});

const variationSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Variation name is required"),
  description: z.string().optional(),
  price_modifier: z.number().optional(),
  sku: z.string().optional(),
  stock_quantity: z.number().int().min(0).optional(),
  is_default: z.boolean().optional(),
});

const productSchema = z.object({
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(200)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  status: z.enum(["draft", "published", "archived"]),
  campus_id: z.string().min(1, "Campus is required"),
  category: z.string().min(1, "Category is required"),
  regular_price: z.number().min(0, "Price must be 0 or greater"),
  member_price: z.number().min(0).optional(),
  member_only: z.boolean().optional(),
  stock: z.number().int().min(0).optional(),
  image: z.string().optional(),
  metadata: z
    .object({
      sku: z.string().optional(),
      images: z.array(z.string()).optional(),
      max_per_user: z.number().int().min(1).optional(),
      max_per_order: z.number().int().min(1).optional(),
      custom_fields: z.array(customFieldSchema).optional(),
      variations: z.array(variationSchema).optional(),
    })
    .optional(),
  translations: z.object({
    en: z.object({
      title: z
        .string()
        .min(3, "English title must be at least 3 characters")
        .max(100, "English title must be 100 characters or fewer"),
      description: z
        .string()
        .min(10, "English description must be at least 10 characters")
        .max(50000),
    }),
    no: z.object({
      title: z
        .string()
        .min(3, "Norwegian title must be at least 3 characters")
        .max(100, "Norwegian title must be 100 characters or fewer"),
      description: z
        .string()
        .min(10, "Norwegian description must be at least 10 characters")
        .max(50000),
    }),
  }),
});

type ProductFormData = z.infer<typeof productSchema>;

// ── Types ─────────────────────────────────────────────────────────────────────

type EditProductProps = {
  product?: ProductWithTranslations;
  campuses?: Campus[];
};

type SlugSource = "en" | "no" | null;
type ProductPayload = CreateProductData | UpdateProductData;

// ── Slug helpers ─���────────────────────────────────────────────────────────────

function getSlugSourceLabel(slugSource: SlugSource): string {
  if (slugSource === "no") return "Norwegian";
  if (slugSource === "en") return "English";
  return "title";
}

function shouldAutoGenerateSlug(isEditingSlug: boolean, isEditing: boolean) {
  return !(isEditingSlug || isEditing);
}

function isTranslationTitleChange(name?: string | null): boolean {
  return Boolean(name?.startsWith("translations.") && name.endsWith(".title"));
}

function computeSlugUpdate(
  slugSource: SlugSource,
  titles: { enTitle: string; noTitle: string }
): { nextSource: SlugSource; slugValue: string } | null {
  if (!slugSource) {
    if (titles.noTitle && !titles.enTitle)
      return { nextSource: "no", slugValue: slugify(titles.noTitle) };
    if (titles.enTitle && !titles.noTitle)
      return { nextSource: "en", slugValue: slugify(titles.enTitle) };
    return null;
  }
  if (slugSource === "no" && titles.noTitle)
    return { nextSource: "no", slugValue: slugify(titles.noTitle) };
  if (slugSource === "no" && !titles.noTitle && titles.enTitle)
    return { nextSource: "en", slugValue: slugify(titles.enTitle) };
  if (slugSource === "en" && titles.enTitle)
    return { nextSource: "en", slugValue: slugify(titles.enTitle) };
  if (slugSource === "en" && !titles.enTitle && titles.noTitle)
    return { nextSource: "no", slugValue: slugify(titles.noTitle) };
  return null;
}

function watchSlugUpdates(
  form: UseFormReturn<ProductFormData>,
  slugSource: SlugSource,
  setSlugSource: (source: SlugSource) => void
) {
  return form.watch((value, { name }) => {
    if (!isTranslationTitleChange(name)) return;
    const slugUpdate = computeSlugUpdate(slugSource, {
      enTitle: value.translations?.en?.title || "",
      noTitle: value.translations?.no?.title || "",
    });
    if (!slugUpdate) return;
    if (slugUpdate.nextSource !== slugSource) setSlugSource(slugUpdate.nextSource);
    form.setValue("slug", slugUpdate.slugValue);
  });
}

function getTitleForSlug(
  form: UseFormReturn<ProductFormData>,
  slugSource: SlugSource
): string | undefined {
  const enTitle = form.getValues("translations.en.title");
  const noTitle = form.getValues("translations.no.title");
  if (slugSource === "no") return noTitle;
  if (slugSource === "en") return enTitle;
  return enTitle || noTitle;
}

function restoreAutoSlug(
  form: UseFormReturn<ProductFormData>,
  slugSource: SlugSource
) {
  const titleToUse = getTitleForSlug(form, slugSource);
  if (titleToUse) form.setValue("slug", slugify(titleToUse));
}

function handleSlugKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  form: UseFormReturn<ProductFormData>,
  slugSource: SlugSource,
  closeEditor: () => void
) {
  if (event.key === "Enter") {
    event.preventDefault();
    closeEditor();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    restoreAutoSlug(form, slugSource);
    closeEditor();
  }
}

// ── Payload builders ──────────────────────────────────────────────────────────

function buildTranslations(translations: ProductFormData["translations"]): {
  en: ProductTranslation;
  no: ProductTranslation;
} {
  return {
    en: { title: translations.en.title, description: translations.en.description },
    no: { title: translations.no.title, description: translations.no.description },
  };
}

function normalizeImages(images?: string[] | null): string[] | undefined {
  if (!images) return;
  const filtered = images.map((u) => u?.trim() || "").filter((u) => u.length > 0);
  return filtered.length > 0 ? filtered : undefined;
}

function normalizeCustomFields(
  customFields?: ProductMetadata["custom_fields"]
): ProductMetadata["custom_fields"] | undefined {
  if (!customFields?.length) return;
  return customFields.map((field) => ({
    ...field,
    options:
      field.type === "select"
        ? (field.options || []).map((o) => o.trim()).filter((o) => o.length > 0)
        : undefined,
  }));
}

function normalizeVariations(
  variations?: ProductMetadata["variations"]
): ProductMetadata["variations"] | undefined {
  if (!variations?.length) return;
  return variations.map((v) => ({
    ...v,
    price_modifier: typeof v.price_modifier === "number" ? v.price_modifier : 0,
    stock_quantity:
      typeof v.stock_quantity === "number" ? Math.max(0, v.stock_quantity) : undefined,
  }));
}

function normalizeMetadata(
  metadata?: ProductFormData["metadata"]
): ProductMetadata | undefined {
  if (!metadata) return;
  const normalized: ProductMetadata = {};
  const images = normalizeImages(metadata.images);
  const customFields = normalizeCustomFields(metadata.custom_fields);
  const variations = normalizeVariations(metadata.variations);
  const sku = metadata.sku?.trim();
  if (sku) normalized.sku = sku;
  if (images) normalized.images = images;
  if (typeof metadata.max_per_user === "number") normalized.max_per_user = metadata.max_per_user;
  if (typeof metadata.max_per_order === "number") normalized.max_per_order = metadata.max_per_order;
  if (customFields) normalized.custom_fields = customFields;
  if (variations) normalized.variations = variations;
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function buildBaseProductPayload(
  data: ProductFormData,
  metadata: ProductMetadata | undefined,
  translations: { en: ProductTranslation; no: ProductTranslation },
  primaryImage: string | null
): ProductPayload {
  return {
    slug: data.slug,
    status: data.status,
    campus_id: data.campus_id,
    category: data.category,
    regular_price: data.regular_price,
    member_price: data.member_price,
    member_only: data.member_only,
    stock: data.stock,
    image: primaryImage || undefined,
    metadata,
    translations,
  };
}

// ── Default values ────────────────────────────────────────────────────────────

function getTranslationForProduct(
  product: ProductWithTranslations | undefined,
  locale: "en" | "no"
): ProductTranslation {
  if (!product?.translation_refs) return { title: "", description: "" };
  const translation = product.translation_refs.find((c) => c.locale === locale);
  if (!translation) return { title: "", description: "" };
  return { title: translation.title || "", description: translation.description || "" };
}

function getProductDefaultValues(
  product: ProductWithTranslations | undefined
): ProductFormData {
  const metadataDefaults = (product?.metadata_parsed as ProductMetadata) ?? {};
  const status =
    product?.status === "draft" ||
    product?.status === "published" ||
    product?.status === "archived"
      ? product.status
      : "draft";

  return {
    slug: product?.slug || "",
    status,
    campus_id: product?.campus_id || "",
    category: product?.category || "",
    regular_price: product?.regular_price ?? 0,
    member_price: product?.member_price ?? undefined,
    member_only: product?.member_only ?? false,
    stock: product?.stock ?? 0,
    image: product?.image || "",
    metadata: {
      sku: metadataDefaults.sku || "",
      images: metadataDefaults.images || [],
      max_per_user: metadataDefaults.max_per_user,
      max_per_order: metadataDefaults.max_per_order,
      custom_fields: metadataDefaults.custom_fields || [],
      variations: metadataDefaults.variations || [],
    },
    translations: {
      en: getTranslationForProduct(product, "en"),
      no: getTranslationForProduct(product, "no"),
    },
  };
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useToggleDefaults(
  product: ProductWithTranslations | undefined,
  setters: {
    setCustomFieldsEnabled: (v: boolean) => void;
    setMemberPricingEnabled: (v: boolean) => void;
    setPurchaseLimitsEnabled: (v: boolean) => void;
    setSkuEnabled: (v: boolean) => void;
    setStockEnabled: (v: boolean) => void;
    setVariationsEnabled: (v: boolean) => void;
  }
) {
  const {
    setCustomFieldsEnabled,
    setMemberPricingEnabled,
    setPurchaseLimitsEnabled,
    setSkuEnabled,
    setStockEnabled,
    setVariationsEnabled,
  } = setters;

  useEffect(() => {
    if (!product) return;
    setMemberPricingEnabled(!!product.member_price);
    setSkuEnabled(!!(product.metadata_parsed as ProductMetadata)?.sku);
    setStockEnabled(product.stock !== undefined && product.stock !== null);
    setPurchaseLimitsEnabled(
      !!(
        (product.metadata_parsed as ProductMetadata)?.max_per_user ||
        (product.metadata_parsed as ProductMetadata)?.max_per_order
      )
    );
    setVariationsEnabled(
      !!(product.metadata_parsed as ProductMetadata)?.variations?.length
    );
    setCustomFieldsEnabled(
      !!(product.metadata_parsed as ProductMetadata)?.custom_fields?.length
    );
  }, [
    product,
    setCustomFieldsEnabled,
    setMemberPricingEnabled,
    setPurchaseLimitsEnabled,
    setSkuEnabled,
    setStockEnabled,
    setVariationsEnabled,
  ]);
}

function useSlugAutofill(
  form: UseFormReturn<ProductFormData>,
  isEditing: boolean,
  isEditingSlug: boolean,
  slugSource: SlugSource,
  setSlugSource: (source: SlugSource) => void
) {
  useEffect(() => {
    if (!shouldAutoGenerateSlug(isEditingSlug, isEditing)) return;
    const subscription = watchSlugUpdates(form, slugSource, setSlugSource);
    return () => subscription.unsubscribe();
  }, [form, isEditing, isEditingSlug, setSlugSource, slugSource]);
}

function useSlugFocus(
  isEditingSlug: boolean,
  slugInputRef: RefObject<HTMLInputElement>
) {
  useEffect(() => {
    if (isEditingSlug && slugInputRef.current) {
      slugInputRef.current.focus();
      slugInputRef.current.select();
    }
  }, [isEditingSlug, slugInputRef]);
}

// ── Sub-components ──��─────────────────────────────────────────────────────────

type SlugFieldProps = {
  closeSlugEditing: () => void;
  form: UseFormReturn<ProductFormData>;
  handleSlugCancel: () => void;
  handleSlugKeyDownEvent: (event: KeyboardEvent<HTMLInputElement>) => void;
  isEditingSlug: boolean;
  slugDescription: string;
  slugInputRef: RefObject<HTMLInputElement>;
  startEditing: () => void;
};

function SlugField({
  closeSlugEditing,
  form,
  handleSlugCancel,
  handleSlugKeyDownEvent,
  isEditingSlug,
  slugDescription,
  slugInputRef,
  startEditing,
}: SlugFieldProps) {
  return (
    <FormField
      control={form.control}
      name="slug"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Slug</FormLabel>
          <FormControl>
            {isEditingSlug ? (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="product-slug"
                  {...field}
                  className="flex-1"
                  onKeyDown={handleSlugKeyDownEvent}
                  ref={(element) => {
                    field.ref(element);
                    slugInputRef.current = element;
                  }}
                />
                <Button
                  className="h-9 w-9 p-0 text-green-600 hover:bg-green-50 hover:text-green-700"
                  onClick={closeSlugEditing}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Check className="h-4 w-4" />
                  <span className="sr-only">Save slug</span>
                </Button>
                <Button
                  className="h-9 w-9 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={handleSlugCancel}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Cancel</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                <code className="flex-1 font-mono text-muted-foreground text-sm">
                  {field.value || "auto-generated-from-title"}
                </code>
                <Button
                  className="h-7 w-7 p-0"
                  onClick={startEditing}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Edit slug</span>
                </Button>
              </div>
            )}
          </FormControl>
          <FormDescription>{slugDescription}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function EditProduct({ product, campuses = [] }: EditProductProps) {
  const router = useRouter();
  const isEditing = !!product;
  const storageKey = `product:${product?.$id ?? "new"}`;

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isTranslating, setIsTranslating] = useState<"en" | "no" | null>(null);
  const [activeLocale, setActiveLocale] = useState<"en" | "no">("en");

  // Slug editing state
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [slugSource, setSlugSource] = useState<SlugSource>(null);
  const slugInputRef = useRef<HTMLInputElement>(null);

  // Toggle states for optional sections
  const [memberPricingEnabled, setMemberPricingEnabled] = useState(false);
  const [skuEnabled, setSkuEnabled] = useState(false);
  const [stockEnabled, setStockEnabled] = useState(false);
  const [purchaseLimitsEnabled, setPurchaseLimitsEnabled] = useState(false);
  const [variationsEnabled, setVariationsEnabled] = useState(false);
  const [customFieldsEnabled, setCustomFieldsEnabled] = useState(false);

  // Draft restore
  const [draftRestoreData, setDraftRestoreData] = useState<{
    values: ProductFormData;
    savedAt: Date;
  } | null>(null);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    mode: "onBlur",
    defaultValues: getProductDefaultValues(product),
  });

  const { isDirty, isSubmitting } = form.formState;

  // Autosave
  const autosave = useAutosave({
    storageKey,
    values: form.watch(),
    isDirty,
    onRestoreDraft: (draft) => {
      setDraftRestoreData({ values: draft as ProductFormData, savedAt: new Date() });
    },
  });

  useDirtyWarning({ isDirty, isSubmitting });

  useToggleDefaults(product, {
    setCustomFieldsEnabled,
    setMemberPricingEnabled,
    setPurchaseLimitsEnabled,
    setSkuEnabled,
    setStockEnabled,
    setVariationsEnabled,
  });

  useSlugAutofill(form, isEditing, isEditingSlug, slugSource, setSlugSource);
  useSlugFocus(isEditingSlug, slugInputRef);

  // ── Translation ──────────────────────────────────────────────────────────

  const handleTranslate = async (
    fromLocale: "en" | "no",
    toLocale: "en" | "no"
  ) => {
    const fromTranslation = form.getValues(`translations.${fromLocale}`);
    if (!(fromTranslation?.title && fromTranslation?.description)) {
      toast({
        title: `Please fill in the ${fromLocale === "en" ? "English" : "Norwegian"} content first`,
        variant: "destructive",
      });
      return;
    }

    const translationData: ProductTranslation = {
      title: fromTranslation.title,
      description: fromTranslation.description,
    };

    setIsTranslating(toLocale);

    try {
      const translated = await translateProductContent(
        translationData,
        fromLocale,
        toLocale
      );
      if (translated) {
        form.setValue(`translations.${toLocale}`, translated);
        toast({
          title: `Content translated to ${toLocale === "en" ? "English" : "Norwegian"}`,
        });
      } else {
        toast({ title: "Translation failed", variant: "destructive" });
      }
    } catch (error) {
      console.error("Translation error:", error);
      toast({ title: "Translation failed", variant: "destructive" });
    } finally {
      setIsTranslating(null);
    }
  };

  // ── Submit ─���─────────────────────────────────────────────────────────────

  const onSubmit: SubmitHandler<ProductFormData> = async (data) => {
    setSaveStatus("saving");
    try {
      const translations = buildTranslations(data.translations);
      const metadata = normalizeMetadata(data.metadata);
      const primaryImage = metadata?.images?.[0] || data.image || null;
      const payload = buildBaseProductPayload(data, metadata, translations, primaryImage);

      if (isEditing && product) {
        await updateProduct(product.$id, payload as UpdateProductData);
        toast({ title: "Product updated successfully" });
      } else {
        await createProduct(payload as CreateProductData);
        toast({ title: "Product created successfully" });
        router.push("/shop/products");
      }

      setSaveStatus("saved");
      autosave.clearDraft();
    } catch (error) {
      console.error("Error saving product:", error);
      toast({ title: "Failed to save product", variant: "destructive" });
      setSaveStatus("error");
    }
  };

  const handleSave = async () => {
    await form.handleSubmit(onSubmit)();
  };

  // ── Slug helpers ─────────────────────────────────────────────────────────

  const closeSlugEditing = () => setIsEditingSlug(false);
  const handleSlugCancel = () => {
    restoreAutoSlug(form, slugSource);
    closeSlugEditing();
  };
  const handleSlugKeyDownEvent = (event: KeyboardEvent<HTMLInputElement>) =>
    handleSlugKeyDown(event, form, slugSource, closeSlugEditing);
  const slugDescription = isEditingSlug
    ? "Press Enter to save, Escape to cancel"
    : `Auto-generated from ${getSlugSourceLabel(slugSource)} · Click edit to customize`;

  // ── Toggle handlers ──────────────────────────────────────────────────────

  const handleMemberPricingToggle = (enabled: boolean) => {
    setMemberPricingEnabled(enabled);
    if (!enabled) form.setValue("member_price", undefined);
  };
  const handleStockToggle = (enabled: boolean) => {
    setStockEnabled(enabled);
    if (!enabled) form.setValue("stock", undefined);
  };
  const handleSkuToggle = (enabled: boolean) => {
    setSkuEnabled(enabled);
    if (!enabled) form.setValue("metadata.sku", "");
  };
  const handlePurchaseLimitsToggle = (enabled: boolean) => {
    setPurchaseLimitsEnabled(enabled);
    if (!enabled) {
      form.setValue("metadata.max_per_user", undefined);
      form.setValue("metadata.max_per_order", undefined);
    }
  };
  const handleVariationsToggle = (enabled: boolean) => {
    setVariationsEnabled(enabled);
    if (!enabled) form.setValue("metadata.variations", []);
  };
  const handleCustomFieldsToggle = (enabled: boolean) => {
    setCustomFieldsEnabled(enabled);
    if (!enabled) form.setValue("metadata.custom_fields", []);
  };

  // ── Watch values for preview ─────────────────────────────────────────────

  const watchValues = form.watch();
  const selectedCampus = campuses.find((c) => c.$id === watchValues.campus_id);

  const enTitle = watchValues.translations?.en?.title ?? "";
  const noTitle = watchValues.translations?.no?.title ?? "";
  const enDesc = watchValues.translations?.en?.description ?? "";
  const noDesc = watchValues.translations?.no?.description ?? "";

  const getLocaleStatus = (title: string, desc: string) => {
    if (title?.length >= 3 && desc?.length >= 10) return "complete" as const;
    if (title || desc) return "partial" as const;
    return "empty" as const;
  };

  const pageTitle = isEditing
    ? (product.translation_refs?.[0]?.title ?? product.slug ?? "Edit Product")
    : "New Product";

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <div className="shrink-0 border-b border-border/40 bg-background px-6 py-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/shop/products">Products</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <PreviewPanel
        renderPreview={(locale) => (
          <ProductPreviewPane
            locale={locale}
            data={{
              status: watchValues.status,
              category: watchValues.category,
              regular_price: watchValues.regular_price,
              member_price: watchValues.member_price,
              member_only: watchValues.member_only,
              stock: watchValues.stock,
              image: watchValues.image,
              metadata: watchValues.metadata,
              translations: {
                en: {
                  title: enTitle,
                  description: enDesc,
                },
                no: {
                  title: noTitle,
                  description: noDesc,
                },
              },
            }}
          />
        )}
      >
        <div className="space-y-6 p-6">
          {/* Draft restore banner */}
          {draftRestoreData && (
            <DraftRestoreBanner
              savedAt={draftRestoreData.savedAt}
              onRestore={() => {
                form.reset(draftRestoreData.values);
                setDraftRestoreData(null);
              }}
              onDiscard={() => {
                autosave.clearDraft();
                setDraftRestoreData(null);
              }}
            />
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Content & Translations */}
              <FormSection
                title="Content & Translations"
                subtitle="Write compelling product copy in both languages"
              >
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <LocaleTabGroup
                      activeLocale={activeLocale}
                      onChange={setActiveLocale}
                      status={{
                        en: getLocaleStatus(enTitle, enDesc),
                        no: getLocaleStatus(noTitle, noDesc),
                      }}
                    />
                    <Button
                      disabled={
                        activeLocale === "en"
                          ? isTranslating === "en" || !noTitle
                          : isTranslating === "no" || !enTitle
                      }
                      onClick={() =>
                        handleTranslate(
                          activeLocale === "en" ? "no" : "en",
                          activeLocale
                        )
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                      className="gap-2"
                    >
                      {isTranslating === activeLocale
                        ? "Translating…"
                        : `Translate to ${activeLocale === "en" ? "English" : "Norwegian"}`}
                    </Button>
                  </div>

                  {(["en", "no"] as const).map((locale) => (
                    <div
                      key={locale}
                      className={locale === activeLocale ? "space-y-4" : "hidden"}
                      role="tabpanel"
                    >
                      <FormField
                        control={form.control}
                        name={`translations.${locale}.title`}
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Title</FormLabel>
                              <CharacterCount
                                current={field.value?.length ?? 0}
                                max={100}
                              />
                            </div>
                            <FormControl>
                              <Input
                                placeholder={
                                  locale === "en"
                                    ? "Product title in English"
                                    : "Produkttittel på norsk"
                                }
                                {...field}
                                value={field.value || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`translations.${locale}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <RichTextEditor
                                content={field.value || ""}
                                editable
                                onChange={field.onChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}
                </div>
              </FormSection>

              {/* Basic Details */}
              <FormSection
                title="Basic Details"
                subtitle="Category, pricing, and availability"
              >
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Input placeholder="Product category" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="regular_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Regular Price (NOK)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="0.00"
                            step="0.01"
                            type="number"
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                Number.parseFloat(e.target.value) || 0
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="member_only"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/60 p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Members Only
                          </FormLabel>
                          <FormDescription>
                            Only members can purchase this product
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>

              {/* Optional Sections */}
              <FormSection
                title="Pricing & Inventory"
                subtitle="Member pricing, stock management, and SKU tracking"
                collapsible
                defaultOpen={
                  memberPricingEnabled || stockEnabled || skuEnabled
                }
              >
                <div className="space-y-4">
                  <ToggleSection
                    description="Set a special price for members"
                    enabled={memberPricingEnabled}
                    icon={DollarSign}
                    onToggle={handleMemberPricingToggle}
                    title="Member Pricing"
                  >
                    <FormField
                      control={form.control}
                      name="member_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Member Price (NOK)</FormLabel>
                          <FormControl>
                            <Input
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(
                                  value ? Number.parseFloat(value) : undefined
                                );
                              }}
                              placeholder="Member price"
                              step="0.01"
                              type="number"
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormDescription>
                            Price for members (must be lower than regular price)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </ToggleSection>

                  <ToggleSection
                    description="Track inventory levels for this product"
                    enabled={stockEnabled}
                    icon={Package}
                    onToggle={handleStockToggle}
                    title="Stock Management"
                  >
                    <FormField
                      control={form.control}
                      name="stock"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock Quantity</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Available quantity"
                              type="number"
                              {...field}
                              onChange={(e) =>
                                field.onChange(
                                  Number.parseInt(e.target.value, 10) || 0
                                )
                              }
                            />
                          </FormControl>
                          <FormDescription>
                            Current inventory count
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </ToggleSection>

                  <ToggleSection
                    description="Add SKU for inventory tracking"
                    enabled={skuEnabled}
                    icon={Hash}
                    onToggle={handleSkuToggle}
                    title="SKU & Tracking"
                  >
                    <FormField
                      control={form.control}
                      name="metadata.sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SKU</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Product SKU"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>
                            Stock Keeping Unit for inventory management
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </ToggleSection>

                  <ToggleSection
                    description="Restrict how many units customers can buy"
                    enabled={purchaseLimitsEnabled}
                    icon={AlertCircle}
                    onToggle={handlePurchaseLimitsToggle}
                    title="Purchase Limits"
                  >
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="metadata.max_per_user"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/60 p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Limit to one per customer
                              </FormLabel>
                              <FormDescription>
                                Prevents customers from purchasing more than once
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={!!field.value && field.value <= 1}
                                onCheckedChange={(checked) =>
                                  field.onChange(checked ? 1 : undefined)
                                }
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="metadata.max_per_order"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Maximum per order</FormLabel>
                            <FormControl>
                              <Input
                                min={1}
                                onChange={(event) => {
                                  const next = event.target.value;
                                  field.onChange(
                                    next
                                      ? Number.parseInt(next, 10)
                                      : undefined
                                  );
                                }}
                                placeholder="Unlimited"
                                type="number"
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormDescription>
                              Maximum units per single checkout
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </ToggleSection>
                </div>
              </FormSection>

              {/* Advanced */}
              <FormSection
                title="Advanced Options"
                subtitle="Product variations and custom checkout fields"
                collapsible
                defaultOpen={variationsEnabled || customFieldsEnabled}
              >
                <Accordion
                  className="space-y-4"
                  defaultValue={[]}
                  type="multiple"
                >
                  <AccordionItem
                    className="overflow-hidden rounded-lg border bg-card"
                    value="options-fields"
                  >
                    <AccordionTrigger className="px-4 py-3 text-left font-semibold text-base hover:no-underline">
                      Configure variations and custom fields
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4 pt-2">
                        <ToggleSection
                          description="Offer different options like sizes, colors, or packages"
                          enabled={variationsEnabled}
                          onToggle={handleVariationsToggle}
                          title="Product Variations"
                        >
                          <FormField
                            control={form.control}
                            name="metadata.variations"
                            render={({ field }) => (
                              <FormItem>
                                <VariationsEditor
                                  onChange={(next) => field.onChange(next)}
                                  value={field.value || []}
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </ToggleSection>

                        <ToggleSection
                          description="Collect additional information from customers during purchase"
                          enabled={customFieldsEnabled}
                          onToggle={handleCustomFieldsToggle}
                          title="Custom Fields"
                        >
                          <FormField
                            control={form.control}
                            name="metadata.custom_fields"
                            render={({ field }) => (
                              <FormItem>
                                <CustomFieldsEditor
                                  onChange={(next) => field.onChange(next)}
                                  value={field.value || []}
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </ToggleSection>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </FormSection>

              {/* Settings (slug, status, campus) + Images */}
              <FormSection
                title="Settings"
                subtitle="Publishing status, URL slug, and campus"
              >
                <div className="space-y-4">
                  <SlugField
                    closeSlugEditing={closeSlugEditing}
                    form={form}
                    handleSlugCancel={handleSlugCancel}
                    handleSlugKeyDownEvent={handleSlugKeyDownEvent}
                    isEditingSlug={isEditingSlug}
                    slugDescription={slugDescription}
                    slugInputRef={slugInputRef}
                    startEditing={() => setIsEditingSlug(true)}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          defaultValue={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="campus_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campus</FormLabel>
                        <Select
                          defaultValue={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select campus" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {campuses.map((campus) => (
                              <SelectItem key={campus.$id} value={campus.$id}>
                                {campus.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedCampus && (
                          <FormDescription>
                            Selected: {selectedCampus.name}
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>

              {/* Cover Images */}
              <FormSection title="Cover Image" subtitle="Product photos">
                <FormField
                  control={form.control}
                  name="metadata.images"
                  render={({ field }) => (
                    <FormItem>
                      <ImageUploadCard
                        images={field.value || []}
                        onChange={(next) => {
                          field.onChange(next);
                          form.setValue("image", next[0] || "");
                        }}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormSection>
            </form>
          </Form>
        </div>
      </PreviewPanel>

      <SaveBar
        status={autosave.isSaving ? "saving" : saveStatus}
        lastSaved={autosave.lastSaved}
        isDirty={isDirty}
        isSubmitting={isSubmitting}
        onSave={handleSave}
        onCancel={() => router.back()}
        autosaveEnabled={autosave.enabled}
        onAutosaveToggle={autosave.setEnabled}
        saveLabel={isEditing ? "Update Product" : "Create Product"}
      />
    </div>
  );
}

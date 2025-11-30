"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  DollarSign,
  Edit2,
  Eye,
  Hash,
  Languages,
  Package,
  Sparkles,
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
import { toast } from "sonner";
import { z } from "zod";
import { listCampuses } from "@/app/actions/events"; // Using from events actions
import {
  createProduct,
  translateProductContent,
  updateProduct,
} from "@/app/actions/products";
import { RichTextEditor } from "@/components/rich-text-editor";
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
import { ProductPreview } from "./product-preview";
import { ToggleSection } from "./toggle-section";
import { VariationsEditor } from "./variations-editor";

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
  slug: z.string().min(1, "Slug is required"),
  status: z.enum(["draft", "published", "archived"]),
  campus_id: z.string().min(1, "Campus is required"),
  // Top-level database fields
  category: z.string().min(1, "Category is required"),
  regular_price: z.number().min(0, "Price must be 0 or greater"),
  member_price: z.number().min(0).optional(),
  member_only: z.boolean().optional(),
  stock: z.number().int().min(0).optional(),
  image: z.string().optional(),
  // Additional fields in metadata
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
      title: z.string().min(1, "English title is required"),
      description: z.string().min(1, "English description is required"),
    }),
    no: z.object({
      title: z.string().min(1, "Norwegian title is required"),
      description: z.string().min(1, "Norwegian description is required"),
    }),
  }),
});

type ProductFormData = z.infer<typeof productSchema>;

type EditProductProps = {
  product?: ProductWithTranslations;
};

type SlugSource = "en" | "no" | null;
type ProductPayload = CreateProductData | UpdateProductData;

const MULTIPLE_SPACES_REGEX = /\s+/g;
const NON_WORD_REGEX = /[^\w-]+/g;
const MULTIPLE_DASHES_REGEX = /--+/g;
const LEADING_DASHES_REGEX = /^-+/;
const TRAILING_DASHES_REGEX = /-+$/;

// Slugify function
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(MULTIPLE_SPACES_REGEX, "-") // Replace spaces with -
    .replace(NON_WORD_REGEX, "") // Remove all non-word chars
    .replace(MULTIPLE_DASHES_REGEX, "-") // Replace multiple - with single -
    .replace(LEADING_DASHES_REGEX, "") // Trim - from start of text
    .replace(TRAILING_DASHES_REGEX, ""); // Trim - from end of text
}

function getSlugSourceLabel(slugSource: SlugSource): string {
  if (slugSource === "no") {
    return "Norwegian";
  }
  if (slugSource === "en") {
    return "English";
  }
  return "title";
}

function shouldAutoGenerateSlug(
  isEditingSlug: boolean,
  isEditing: boolean
): boolean {
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
    if (titles.noTitle && !titles.enTitle) {
      return { nextSource: "no", slugValue: slugify(titles.noTitle) };
    }
    if (titles.enTitle && !titles.noTitle) {
      return { nextSource: "en", slugValue: slugify(titles.enTitle) };
    }
    return null;
  }

  if (slugSource === "no" && titles.noTitle) {
    return { nextSource: "no", slugValue: slugify(titles.noTitle) };
  }
  if (slugSource === "no" && !titles.noTitle && titles.enTitle) {
    return { nextSource: "en", slugValue: slugify(titles.enTitle) };
  }
  if (slugSource === "en" && titles.enTitle) {
    return { nextSource: "en", slugValue: slugify(titles.enTitle) };
  }
  if (slugSource === "en" && !titles.enTitle && titles.noTitle) {
    return { nextSource: "no", slugValue: slugify(titles.noTitle) };
  }
  return null;
}

function watchSlugUpdates(
  form: UseFormReturn<ProductFormData>,
  slugSource: SlugSource,
  setSlugSource: (source: SlugSource) => void
) {
  return form.watch((value, { name }) => {
    if (!isTranslationTitleChange(name)) {
      return;
    }

    const slugUpdate = computeSlugUpdate(slugSource, {
      enTitle: value.translations?.en?.title || "",
      noTitle: value.translations?.no?.title || "",
    });

    if (!slugUpdate) {
      return;
    }

    if (slugUpdate.nextSource !== slugSource) {
      setSlugSource(slugUpdate.nextSource);
    }

    form.setValue("slug", slugUpdate.slugValue);
  });
}

function getTitleForSlug(
  form: UseFormReturn<ProductFormData>,
  slugSource: SlugSource
): string | undefined {
  const enTitle = form.getValues("translations.en.title");
  const noTitle = form.getValues("translations.no.title");

  if (slugSource === "no") {
    return noTitle;
  }
  if (slugSource === "en") {
    return enTitle;
  }
  return enTitle || noTitle;
}

function restoreAutoSlug(
  form: UseFormReturn<ProductFormData>,
  slugSource: SlugSource
) {
  const titleToUse = getTitleForSlug(form, slugSource);
  if (titleToUse) {
    form.setValue("slug", slugify(titleToUse));
  }
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

function buildTranslations(translations: ProductFormData["translations"]): {
  en: ProductTranslation;
  no: ProductTranslation;
} {
  return {
    en: {
      title: translations.en.title,
      description: translations.en.description,
    },
    no: {
      title: translations.no.title,
      description: translations.no.description,
    },
  };
}

function normalizeImages(images?: string[] | null): string[] | undefined {
  if (!images) {
    return;
  }

  const filtered = images
    .map((url) => url?.trim() || "")
    .filter((url) => url.length > 0);

  return filtered.length > 0 ? filtered : undefined;
}

function normalizeCustomFields(
  customFields?: ProductMetadata["custom_fields"]
): ProductMetadata["custom_fields"] | undefined {
  if (!customFields?.length) {
    return;
  }

  return customFields.map((field) => ({
    ...field,
    options:
      field.type === "select"
        ? (field.options || [])
            .map((option) => option.trim())
            .filter((option) => option.length > 0)
        : undefined,
  }));
}

function normalizeVariations(
  variations?: ProductMetadata["variations"]
): ProductMetadata["variations"] | undefined {
  if (!variations?.length) {
    return;
  }

  return variations.map((variation) => ({
    ...variation,
    price_modifier:
      typeof variation.price_modifier === "number"
        ? variation.price_modifier
        : 0,
    stock_quantity:
      typeof variation.stock_quantity === "number"
        ? Math.max(0, variation.stock_quantity)
        : undefined,
  }));
}

function normalizeMetadata(
  metadata?: ProductFormData["metadata"]
): ProductMetadata | undefined {
  if (!metadata) {
    return;
  }

  const normalized: ProductMetadata = {};
  const images = normalizeImages(metadata.images);
  const customFields = normalizeCustomFields(metadata.custom_fields);
  const variations = normalizeVariations(metadata.variations);
  const sku = metadata.sku?.trim();

  if (sku) {
    normalized.sku = sku;
  }
  if (images) {
    normalized.images = images;
  }
  if (typeof metadata.max_per_user === "number") {
    normalized.max_per_user = metadata.max_per_user;
  }
  if (typeof metadata.max_per_order === "number") {
    normalized.max_per_order = metadata.max_per_order;
  }
  if (customFields) {
    normalized.custom_fields = customFields;
  }
  if (variations) {
    normalized.variations = variations;
  }

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

function useCampusesData(setCampuses: (campuses: Campus[]) => void) {
  useEffect(() => {
    async function fetchCampuses() {
      try {
        const campusData = await listCampuses();
        setCampuses(campusData);
      } catch (error) {
        console.error("Error fetching campuses:", error);
        toast.error("Failed to load campuses");
      }
    }

    fetchCampuses();
  }, [setCampuses]);
}

type ToggleDefaultsConfig = {
  product: ProductWithTranslations | undefined;
  setCustomFieldsEnabled: (value: boolean) => void;
  setMemberPricingEnabled: (value: boolean) => void;
  setPurchaseLimitsEnabled: (value: boolean) => void;
  setSkuEnabled: (value: boolean) => void;
  setStockEnabled: (value: boolean) => void;
  setVariationsEnabled: (value: boolean) => void;
};

function useToggleDefaults({
  product,
  setCustomFieldsEnabled,
  setMemberPricingEnabled,
  setPurchaseLimitsEnabled,
  setSkuEnabled,
  setStockEnabled,
  setVariationsEnabled,
}: ToggleDefaultsConfig) {
  useEffect(() => {
    if (!product) {
      return;
    }
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

type SlugAutofillConfig = {
  form: UseFormReturn<ProductFormData>;
  isEditing: boolean;
  isEditingSlug: boolean;
  setSlugSource: (source: SlugSource) => void;
  slugSource: SlugSource;
};

function useSlugAutofill({
  form,
  isEditing,
  isEditingSlug,
  setSlugSource,
  slugSource,
}: SlugAutofillConfig) {
  useEffect(() => {
    if (!shouldAutoGenerateSlug(isEditingSlug, isEditing)) {
      return;
    }

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

function getTranslationForProduct(
  product: ProductWithTranslations | undefined,
  locale: "en" | "no"
): ProductTranslation {
  if (!product?.translation_refs) {
    return { title: "", description: "" };
  }

  const translation = product.translation_refs.find(
    (candidate) => candidate.locale === locale
  );

  if (!translation) {
    return { title: "", description: "" };
  }

  return {
    title: translation.title || "",
    description: translation.description || "",
  };
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
                  className="glass-input flex-1"
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
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-white/40 px-3 py-2">
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

type ProductHeaderProps = {
  isEditing: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onCancel: () => void;
  onSave: () => void;
  status: ProductFormData["status"];
  title: string;
};

function ProductHeader({
  isEditing,
  isSubmitting,
  onBack,
  onCancel,
  onSave,
  status,
  title,
}: ProductHeaderProps) {
  return (
    <div className="mb-4 flex items-center gap-4">
      <Button
        className="h-7 w-7"
        onClick={onBack}
        size="icon"
        variant="outline"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">Back</span>
      </Button>
      <h1 className="flex-1 shrink-0 whitespace-nowrap font-semibold text-xl tracking-tight sm:grow-0">
        {isEditing ? `Edit ${title}` : "New Product"}
      </h1>
      <Badge className="ml-auto sm:ml-0" variant="outline">
        {status}
      </Badge>
      <div className="hidden items-center gap-2 md:ml-auto md:flex">
        <Button onClick={onCancel} size="sm" variant="outline">
          Cancel
        </Button>
        <Button disabled={isSubmitting} onClick={onSave} size="sm">
          {isSubmitting ? "Saving..." : "Save Product"}
        </Button>
      </div>
    </div>
  );
}

type ProductContentSectionProps = {
  form: UseFormReturn<ProductFormData>;
  handleTranslate: (
    fromLocale: "en" | "no",
    toLocale: "en" | "no"
  ) => Promise<void>;
  isTranslating: "en" | "no" | null;
};

function ProductContentSection({
  form,
  handleTranslate,
  isTranslating,
}: ProductContentSectionProps) {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="h-5 w-5" />
          Product Content
        </CardTitle>
        <CardDescription>
          Manage product content in multiple languages
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs className="w-full" defaultValue="en">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger className="flex items-center gap-2" value="en">
              🇬🇧 English
            </TabsTrigger>
            <TabsTrigger className="flex items-center gap-2" value="no">
              🇳🇴 Norsk
            </TabsTrigger>
          </TabsList>

          <TabsContent className="mt-4 space-y-4" value="en">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-lg">English Content</h3>
              <Button
                className="flex items-center gap-2"
                disabled={isTranslating === "en"}
                onClick={() => handleTranslate("no", "en")}
                size="sm"
                type="button"
                variant="outline"
              >
                <Sparkles className="h-4 w-4" />
                {isTranslating === "en"
                  ? "Translating..."
                  : "Translate from Norwegian"}
              </Button>
            </div>
            <FormField
              control={form.control}
              name="translations.en.title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Product title in English"
                      {...field}
                      className="glass-input"
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="translations.en.description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      content={field.value || ""}
                      editable={true}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          <TabsContent className="mt-4 space-y-4" value="no">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-lg">Norwegian Content</h3>
              <Button
                className="flex items-center gap-2"
                disabled={isTranslating === "no"}
                onClick={() => handleTranslate("en", "no")}
                size="sm"
                type="button"
                variant="outline"
              >
                <Sparkles className="h-4 w-4" />
                {isTranslating === "no"
                  ? "Translating..."
                  : "Translate from English"}
              </Button>
            </div>
            <FormField
              control={form.control}
              name="translations.no.title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tittel</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Produkttittel på norsk"
                      {...field}
                      className="glass-input"
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="translations.no.description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beskrivelse</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      content={field.value || ""}
                      editable={true}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export function EditProduct({ product }: EditProductProps) {
  const router = useRouter();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTranslating, setIsTranslating] = useState<"en" | "no" | null>(null);
  const [previewLocale, setPreviewLocale] = useState<"en" | "no">("en");

  // Slug editing state
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [slugSource, setSlugSource] = useState<"en" | "no" | null>(null);
  const slugInputRef = useRef<HTMLInputElement>(null);

  // Toggle states for optional sections
  const [memberPricingEnabled, setMemberPricingEnabled] = useState(false);
  const [skuEnabled, setSkuEnabled] = useState(false);
  const [stockEnabled, setStockEnabled] = useState(false);
  const [purchaseLimitsEnabled, setPurchaseLimitsEnabled] = useState(false);
  const [variationsEnabled, setVariationsEnabled] = useState(false);
  const [customFieldsEnabled, setCustomFieldsEnabled] = useState(false);

  const isEditing = !!product;

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: getProductDefaultValues(product),
  });

  useCampusesData(setCampuses);
  useToggleDefaults({
    product,
    setCustomFieldsEnabled,
    setMemberPricingEnabled,
    setPurchaseLimitsEnabled,
    setSkuEnabled,
    setStockEnabled,
    setVariationsEnabled,
  });
  useSlugAutofill({
    form,
    isEditing,
    isEditingSlug,
    setSlugSource,
    slugSource,
  });
  useSlugFocus(isEditingSlug, slugInputRef);

  const handleTranslate = async (
    fromLocale: "en" | "no",
    toLocale: "en" | "no"
  ) => {
    const fromTranslation = form.getValues(`translations.${fromLocale}`);
    if (!(fromTranslation?.title && fromTranslation?.description)) {
      toast.error(
        `Please fill in the ${fromLocale === "en" ? "English" : "Norwegian"} content first`
      );
      return;
    }

    // Ensure we have the required fields for ProductTranslation
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
        toast.success(
          `Content translated to ${toLocale === "en" ? "English" : "Norwegian"}`
        );
      } else {
        toast.error("Translation failed");
      }
    } catch (error) {
      console.error("Translation error:", error);
      toast.error("Translation failed");
    } finally {
      setIsTranslating(null);
    }
  };

  const onSubmit: SubmitHandler<ProductFormData> = async (data) => {
    setIsSubmitting(true);

    try {
      const translations = buildTranslations(data.translations);
      const metadata = normalizeMetadata(data.metadata);
      const primaryImage = metadata?.images?.[0] || data.image || null;
      const payload = buildBaseProductPayload(
        data,
        metadata,
        translations,
        primaryImage
      );

      if (isEditing && product) {
        await updateProduct(product.$id, payload as UpdateProductData);
        toast.success("Product updated successfully");
      } else {
        await createProduct(payload as CreateProductData);
        toast.success("Product created successfully");
      }

      router.push("/admin/shop/products");
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Failed to save product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCampus = campuses.find(
    (c) => c.$id === form.watch("campus_id")
  );
  const closeSlugEditing = () => setIsEditingSlug(false);
  const handleSlugCancel = () => {
    restoreAutoSlug(form, slugSource);
    closeSlugEditing();
  };
  const handleSlugKeyDownEvent = (event: KeyboardEvent<HTMLInputElement>) =>
    handleSlugKeyDown(event, form, slugSource, closeSlugEditing);
  const slugDescription = isEditingSlug
    ? "Press Enter to save, Escape to cancel"
    : `Auto-generated from ${getSlugSourceLabel(slugSource)} • Click edit to customize`;
  const handleMemberPricingToggle = (enabled: boolean) => {
    setMemberPricingEnabled(enabled);
    if (!enabled) {
      form.setValue("member_price", undefined);
    }
  };
  const handleStockToggle = (enabled: boolean) => {
    setStockEnabled(enabled);
    if (!enabled) {
      form.setValue("stock", undefined);
    }
  };
  const handleSkuToggle = (enabled: boolean) => {
    setSkuEnabled(enabled);
    if (!enabled) {
      form.setValue("metadata.sku", "");
    }
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
    if (!enabled) {
      form.setValue("metadata.variations", []);
    }
  };
  const handleCustomFieldsToggle = (enabled: boolean) => {
    setCustomFieldsEnabled(enabled);
    if (!enabled) {
      form.setValue("metadata.custom_fields", []);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <div className="flex flex-col sm:gap-4">
        <main className="grid flex-1 items-start gap-4">
          <ProductHeader
            isEditing={isEditing}
            isSubmitting={isSubmitting}
            onBack={() => router.back()}
            onCancel={() => router.back()}
            onSave={form.handleSubmit(onSubmit)}
            status={form.watch("status")}
            title={product?.translation_refs?.[0]?.title || product?.slug || ""}
          />

          <Form {...form}>
            <form
              className="grid gap-6 lg:grid-cols-[1fr_400px]"
              onSubmit={form.handleSubmit(onSubmit)}
            >
              {/* LEFT COLUMN - Form Content */}
              <div className="space-y-6">
                {/* Product Content with Translations */}
                <ProductContentSection
                  form={form}
                  handleTranslate={handleTranslate}
                  isTranslating={isTranslating}
                />

                {/* Basic Product Details */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Basic Details</CardTitle>
                    <CardDescription>
                      Configure essential product information
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Product category"
                              {...field}
                              className="glass-input"
                            />
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
                              className="glass-input"
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
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-primary/20 bg-white/40 p-4">
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
                  </CardContent>
                </Card>

                {/* Toggle Sections for Optional Fields */}
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
                              className="glass-input"
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
                              className="glass-input"
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
                              className="glass-input"
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
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-primary/20 bg-white/40 p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Limit to one per customer
                              </FormLabel>
                              <FormDescription>
                                Prevents customers from purchasing more than
                                once
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
                                className="glass-input"
                                min={1}
                                onChange={(event) => {
                                  const next = event.target.value;
                                  field.onChange(
                                    next ? Number.parseInt(next, 10) : undefined
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

                {/* Options & Fields Accordion */}
                <Accordion
                  className="space-y-4"
                  defaultValue={[]}
                  type="multiple"
                >
                  <AccordionItem
                    className="glass-card overflow-hidden rounded-lg border bg-card"
                    value="options-fields"
                  >
                    <AccordionTrigger className="px-4 py-3 text-left font-semibold text-base hover:no-underline">
                      Advanced Options
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <p className="pb-4 text-muted-foreground text-sm">
                        Configure product variations and custom fields for
                        additional customer input.
                      </p>
                      <div className="space-y-4">
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
              </div>

              {/* RIGHT COLUMN - Sticky Sidebar */}
              <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
                {/* Status & Campus */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Product Settings</CardTitle>
                    <CardDescription>
                      Configure status and location
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
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
                              <SelectTrigger className="glass-input">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="published">
                                Published
                              </SelectItem>
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
                              <SelectTrigger className="glass-input">
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
                  </CardContent>
                </Card>

                {/* Product Images */}
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

                {/* Live Preview */}
                <Card className="glass-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        Live Preview
                      </CardTitle>
                      <Tabs
                        className="w-auto"
                        onValueChange={(value) =>
                          setPreviewLocale(value as "en" | "no")
                        }
                        value={previewLocale}
                      >
                        <TabsList className="h-8">
                          <TabsTrigger className="px-2 text-xs" value="en">
                            🇬🇧
                          </TabsTrigger>
                          <TabsTrigger className="px-2 text-xs" value="no">
                            🇳🇴
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <CardDescription>
                      See how your product will appear to customers
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ProductPreview
                      data={form.watch()}
                      locale={previewLocale}
                    />
                  </CardContent>
                </Card>
              </div>
            </form>
          </Form>

          {/* Mobile Actions */}
          <div className="mt-4 flex items-center justify-center gap-2 md:hidden">
            <Button onClick={() => router.back()} size="sm" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={form.handleSubmit(onSubmit)}
              size="sm"
            >
              {isSubmitting ? "Saving..." : "Save Product"}
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}

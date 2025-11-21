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
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Switch } from "@repo/ui/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Textarea } from "@repo/ui/components/ui/textarea";
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
import { useEffect, useRef, useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { listCampuses } from "@/app/actions/events"; // Using from events actions
import { createProduct, translateProductContent, updateProduct } from "@/app/actions/products";
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

interface EditProductProps {
  product?: ProductWithTranslations;
}

// Slugify function
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
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

  // Extract translations from product
  const getTranslation = (locale: "en" | "no"): ProductTranslation => {
    if (!product?.translation_refs) {
      return { title: "", description: "" };
    }

    const translation = product.translation_refs.find((t) => t.locale === locale);
    if (!translation) {
      return { title: "", description: "" };
    }

    return {
      title: translation.title || "",
      description: translation.description || "",
    };
  };

  const metadataDefaults = product?.metadata_parsed ?? {};

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      slug: product?.slug || "",
      status:
        product?.status === "draft" ||
        product?.status === "published" ||
        product?.status === "archived"
          ? product.status
          : "draft",
      campus_id: product?.campus_id || "",
      // Top-level database fields
      category: product?.category || "",
      regular_price: product?.regular_price ?? 0,
      member_price: product?.member_price ?? undefined,
      member_only: product?.member_only ?? false,
      stock: product?.stock ?? 0,
      image: product?.image || "",
      // Metadata fields
      metadata: {
        sku: (metadataDefaults as ProductMetadata).sku || "",
        images: (metadataDefaults as ProductMetadata).images || [],
        max_per_user: (metadataDefaults as ProductMetadata).max_per_user,
        max_per_order: (metadataDefaults as ProductMetadata).max_per_order,
        custom_fields: (metadataDefaults as ProductMetadata).custom_fields || [],
        variations: (metadataDefaults as ProductMetadata).variations || [],
      },
      translations: {
        en: getTranslation("en"),
        no: getTranslation("no"),
      },
    },
  });

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
  }, []);

  // Initialize toggle states based on existing data
  useEffect(() => {
    if (product) {
      setMemberPricingEnabled(!!product.member_price);
      setSkuEnabled(!!(product.metadata_parsed as ProductMetadata)?.sku);
      setStockEnabled(product.stock !== undefined && product.stock !== null);
      setPurchaseLimitsEnabled(
        !!(
          (product.metadata_parsed as ProductMetadata)?.max_per_user ||
          (product.metadata_parsed as ProductMetadata)?.max_per_order
        ),
      );
      setVariationsEnabled(!!(product.metadata_parsed as ProductMetadata)?.variations?.length);
      setCustomFieldsEnabled(!!(product.metadata_parsed as ProductMetadata)?.custom_fields?.length);
    }
  }, [product]);

  // Auto-generate slug from title
  useEffect(() => {
    // Don't auto-generate if user is manually editing
    if (isEditingSlug) return;

    // Don't auto-generate if editing existing product (preserve manual slug)
    if (product) return;

    const subscription = form.watch((value, { name }) => {
      // Only react to title changes
      if (!name?.startsWith("translations.")) return;
      if (!name?.endsWith(".title")) return;

      const enTitle = value.translations?.en?.title || "";
      const noTitle = value.translations?.no?.title || "";

      // Determine which language to use for slug
      if (!slugSource) {
        // No source set yet - use whichever has content first
        if (noTitle && !enTitle) {
          setSlugSource("no");
          form.setValue("slug", slugify(noTitle));
        } else if (enTitle && !noTitle) {
          setSlugSource("en");
          form.setValue("slug", slugify(enTitle));
        }
      } else if (slugSource === "no") {
        // Norwegian was set first
        if (noTitle) {
          // Norwegian still has content, keep using it
          form.setValue("slug", slugify(noTitle));
        } else if (!noTitle && enTitle) {
          // Norwegian was cleared, switch to English
          setSlugSource("en");
          form.setValue("slug", slugify(enTitle));
        }
      } else if (slugSource === "en") {
        // English was set first
        if (enTitle) {
          // English still has content, keep using it
          form.setValue("slug", slugify(enTitle));
        } else if (!enTitle && noTitle) {
          // English was cleared, switch to Norwegian
          setSlugSource("no");
          form.setValue("slug", slugify(noTitle));
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [form, isEditingSlug, slugSource, product]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingSlug && slugInputRef.current) {
      slugInputRef.current.focus();
      slugInputRef.current.select();
    }
  }, [isEditingSlug]);

  const handleTranslate = async (fromLocale: "en" | "no", toLocale: "en" | "no") => {
    const fromTranslation = form.getValues(`translations.${fromLocale}`);
    if (!fromTranslation?.title || !fromTranslation?.description) {
      toast.error(
        `Please fill in the ${fromLocale === "en" ? "English" : "Norwegian"} content first`,
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
      const translated = await translateProductContent(translationData, fromLocale, toLocale);
      if (translated) {
        form.setValue(`translations.${toLocale}`, translated);
        toast.success(`Content translated to ${toLocale === "en" ? "English" : "Norwegian"}`);
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
      // Transform the form data to match the expected types
      const transformedTranslations: { en: ProductTranslation; no: ProductTranslation } = {
        en: {
          title: data.translations.en.title,
          description: data.translations.en.description,
        },
        no: {
          title: data.translations.no.title,
          description: data.translations.no.description,
        },
      };

      // Process metadata fields
      const metadata: ProductMetadata | undefined = data.metadata
        ? { ...data.metadata }
        : undefined;

      if (metadata) {
        // Clean up images array
        const imageList = Array.isArray(metadata.images)
          ? metadata.images.filter(
              (url): url is string => typeof url === "string" && url.trim().length > 0,
            )
          : [];
        metadata.images = imageList.length > 0 ? imageList : undefined;

        // Clean up custom fields
        if (!metadata.custom_fields || metadata.custom_fields.length === 0) {
          delete metadata.custom_fields;
        } else {
          metadata.custom_fields = metadata.custom_fields.map((field) => ({
            ...field,
            options:
              field.type === "select"
                ? (field.options || []).filter((option) => option.trim().length > 0)
                : undefined,
          }));
        }

        // Clean up variations
        if (!metadata.variations || metadata.variations.length === 0) {
          delete metadata.variations;
        } else {
          metadata.variations = metadata.variations.map((variation) => ({
            ...variation,
            price_modifier:
              typeof variation.price_modifier === "number" ? variation.price_modifier : 0,
            stock_quantity:
              typeof variation.stock_quantity === "number"
                ? Math.max(0, variation.stock_quantity)
                : undefined,
          }));
        }

        // Clean up optional fields
        if (!metadata.max_per_user) delete metadata.max_per_user;
        if (!metadata.max_per_order) delete metadata.max_per_order;

        if (metadata.sku) metadata.sku = metadata.sku.trim();
        if (!metadata.sku) delete metadata.sku;
      }

      // Determine image (from metadata.images or existing)
      const primaryImage = metadata?.images?.[0] || data.image || null;

      if (isEditing && product) {
        const updateData: UpdateProductData = {
          slug: data.slug,
          status: data.status,
          campus_id: data.campus_id,
          // Top-level fields
          category: data.category,
          regular_price: data.regular_price,
          member_price: data.member_price,
          member_only: data.member_only,
          stock: data.stock,
          image: primaryImage || undefined,
          // Metadata
          metadata,
          translations: transformedTranslations,
        };
        await updateProduct(product.$id, updateData);
        toast.success("Product updated successfully");
      } else {
        const createData: CreateProductData = {
          slug: data.slug,
          status: data.status,
          campus_id: data.campus_id,
          // Top-level fields
          category: data.category,
          regular_price: data.regular_price,
          member_price: data.member_price,
          member_only: data.member_only,
          stock: data.stock,
          image: primaryImage || undefined,
          // Metadata
          metadata,
          translations: transformedTranslations,
        };
        await createProduct(createData);
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

  const selectedCampus = campuses.find((c) => c.$id === form.watch("campus_id"));

  return (
    <div className="flex min-h-screen w-full flex-col">
      <div className="flex flex-col sm:gap-4">
        <main className="grid flex-1 items-start gap-4">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => router.back()}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Button>
            <h1 className="flex-1 shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight sm:grow-0">
              {isEditing
                ? `Edit ${product.translation_refs?.[0]?.title || product.slug}`
                : "New Product"}
            </h1>
            <Badge variant="outline" className="ml-auto sm:ml-0">
              {form.watch("status")}
            </Badge>
            <div className="hidden items-center gap-2 md:ml-auto md:flex">
              <Button variant="outline" size="sm" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button size="sm" onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Product"}
              </Button>
            </div>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid gap-6 lg:grid-cols-[1fr_400px]"
            >
              {/* LEFT COLUMN - Form Content */}
              <div className="space-y-6">
                {/* Product Content with Translations */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Languages className="h-5 w-5" />
                      Product Content
                    </CardTitle>
                    <CardDescription>Manage product content in multiple languages</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="en" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="en" className="flex items-center gap-2">
                          🇬🇧 English
                        </TabsTrigger>
                        <TabsTrigger value="no" className="flex items-center gap-2">
                          🇳🇴 Norsk
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="en" className="space-y-4 mt-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-medium">English Content</h3>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleTranslate("no", "en")}
                            disabled={isTranslating === "en"}
                            className="flex items-center gap-2"
                          >
                            <Sparkles className="h-4 w-4" />
                            {isTranslating === "en" ? "Translating..." : "Translate from Norwegian"}
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
                                  value={field.value || ""}
                                  className="glass-input"
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
                                  onChange={field.onChange}
                                  editable={true}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TabsContent>

                      <TabsContent value="no" className="space-y-4 mt-4">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-medium">Norwegian Content</h3>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleTranslate("en", "no")}
                            disabled={isTranslating === "no"}
                            className="flex items-center gap-2"
                          >
                            <Sparkles className="h-4 w-4" />
                            {isTranslating === "no" ? "Translating..." : "Translate from English"}
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
                                  value={field.value || ""}
                                  className="glass-input"
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
                                  onChange={field.onChange}
                                  editable={true}
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

                {/* Basic Product Details */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Basic Details</CardTitle>
                    <CardDescription>Configure essential product information</CardDescription>
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
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              className="glass-input"
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
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-primary/20 p-4 bg-white/40">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Members Only</FormLabel>
                            <FormDescription>
                              Only members can purchase this product
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Toggle Sections for Optional Fields */}
                <div className="space-y-4">
                  <ToggleSection
                    title="Member Pricing"
                    description="Set a special price for members"
                    enabled={memberPricingEnabled}
                    onToggle={(enabled) => {
                      setMemberPricingEnabled(enabled);
                      if (!enabled) form.setValue("member_price", undefined);
                    }}
                    icon={DollarSign}
                  >
                    <FormField
                      control={form.control}
                      name="member_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Member Price (NOK)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Member price"
                              value={field.value ?? ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value ? parseFloat(value) : undefined);
                              }}
                              className="glass-input"
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
                    title="Stock Management"
                    description="Track inventory levels for this product"
                    enabled={stockEnabled}
                    onToggle={(enabled) => {
                      setStockEnabled(enabled);
                      if (!enabled) form.setValue("stock", undefined);
                    }}
                    icon={Package}
                  >
                    <FormField
                      control={form.control}
                      name="stock"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="Available quantity"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              className="glass-input"
                            />
                          </FormControl>
                          <FormDescription>Current inventory count</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </ToggleSection>

                  <ToggleSection
                    title="SKU & Tracking"
                    description="Add SKU for inventory tracking"
                    enabled={skuEnabled}
                    onToggle={(enabled) => {
                      setSkuEnabled(enabled);
                      if (!enabled) form.setValue("metadata.sku", "");
                    }}
                    icon={Hash}
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
                              className="glass-input"
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
                    title="Purchase Limits"
                    description="Restrict how many units customers can buy"
                    enabled={purchaseLimitsEnabled}
                    onToggle={(enabled) => {
                      setPurchaseLimitsEnabled(enabled);
                      if (!enabled) {
                        form.setValue("metadata.max_per_user", undefined);
                        form.setValue("metadata.max_per_order", undefined);
                      }
                    }}
                    icon={AlertCircle}
                  >
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="metadata.max_per_user"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-primary/20 p-4 bg-white/40">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Limit to one per customer</FormLabel>
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
                                type="number"
                                min={1}
                                value={field.value ?? ""}
                                onChange={(event) => {
                                  const next = event.target.value;
                                  field.onChange(next ? parseInt(next) : undefined);
                                }}
                                placeholder="Unlimited"
                                className="glass-input"
                              />
                            </FormControl>
                            <FormDescription>Maximum units per single checkout</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </ToggleSection>
                </div>

                {/* Options & Fields Accordion */}
                <Accordion type="multiple" defaultValue={[]} className="space-y-4">
                  <AccordionItem
                    value="options-fields"
                    className="overflow-hidden rounded-lg border bg-card glass-card"
                  >
                    <AccordionTrigger className="px-4 py-3 text-left text-base font-semibold hover:no-underline">
                      Advanced Options
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <p className="pb-4 text-sm text-muted-foreground">
                        Configure product variations and custom fields for additional customer
                        input.
                      </p>
                      <div className="space-y-4">
                        <ToggleSection
                          title="Product Variations"
                          description="Offer different options like sizes, colors, or packages"
                          enabled={variationsEnabled}
                          onToggle={(enabled) => {
                            setVariationsEnabled(enabled);
                            if (!enabled) form.setValue("metadata.variations", []);
                          }}
                        >
                          <FormField
                            control={form.control}
                            name="metadata.variations"
                            render={({ field }) => (
                              <FormItem>
                                <VariationsEditor
                                  value={field.value || []}
                                  onChange={(next) => field.onChange(next)}
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </ToggleSection>

                        <ToggleSection
                          title="Custom Fields"
                          description="Collect additional information from customers during purchase"
                          enabled={customFieldsEnabled}
                          onToggle={(enabled) => {
                            setCustomFieldsEnabled(enabled);
                            if (!enabled) form.setValue("metadata.custom_fields", []);
                          }}
                        >
                          <FormField
                            control={form.control}
                            name="metadata.custom_fields"
                            render={({ field }) => (
                              <FormItem>
                                <CustomFieldsEditor
                                  value={field.value || []}
                                  onChange={(next) => field.onChange(next)}
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
              <div className="lg:sticky lg:top-6 lg:self-start space-y-6">
                {/* Status & Campus */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Product Settings</CardTitle>
                    <CardDescription>Configure status and location</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <FormField
                      control={form.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Slug</FormLabel>
                          <FormControl>
                            {!isEditingSlug ? (
                              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-white/40 px-3 py-2">
                                <code className="flex-1 text-sm font-mono text-muted-foreground">
                                  {field.value || "auto-generated-from-title"}
                                </code>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => setIsEditingSlug(true)}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                  <span className="sr-only">Edit slug</span>
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Input
                                  placeholder="product-slug"
                                  {...field}
                                  ref={(e) => {
                                    field.ref(e);
                                    slugInputRef.current = e;
                                  }}
                                  className="glass-input flex-1"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      setIsEditingSlug(false);
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      setIsEditingSlug(false);
                                      // Reset to auto-generated slug
                                      const enTitle = form.getValues("translations.en.title");
                                      const noTitle = form.getValues("translations.no.title");
                                      const titleToUse = slugSource === "no" ? noTitle : enTitle;
                                      if (titleToUse) {
                                        form.setValue("slug", slugify(titleToUse));
                                      }
                                    }
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => setIsEditingSlug(false)}
                                >
                                  <Check className="h-4 w-4" />
                                  <span className="sr-only">Save slug</span>
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    setIsEditingSlug(false);
                                    // Reset to auto-generated slug
                                    const enTitle = form.getValues("translations.en.title");
                                    const noTitle = form.getValues("translations.no.title");
                                    const titleToUse = slugSource === "no" ? noTitle : enTitle;
                                    if (titleToUse) {
                                      form.setValue("slug", slugify(titleToUse));
                                    }
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                  <span className="sr-only">Cancel</span>
                                </Button>
                              </div>
                            )}
                          </FormControl>
                          <FormDescription>
                            {!isEditingSlug
                              ? `Auto-generated from ${slugSource === "no" ? "Norwegian" : slugSource === "en" ? "English" : "title"} • Click edit to customize`
                              : "Press Enter to save, Escape to cancel"}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="glass-input">
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                            <FormDescription>Selected: {selectedCampus.name}</FormDescription>
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
                        value={previewLocale}
                        onValueChange={(value) => setPreviewLocale(value as "en" | "no")}
                        className="w-auto"
                      >
                        <TabsList className="h-8">
                          <TabsTrigger value="en" className="text-xs px-2">
                            🇬🇧
                          </TabsTrigger>
                          <TabsTrigger value="no" className="text-xs px-2">
                            🇳🇴
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <CardDescription>See how your product will appear to customers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ProductPreview data={form.watch()} locale={previewLocale} />
                  </CardContent>
                </Card>
              </div>
            </form>
          </Form>

          {/* Mobile Actions */}
          <div className="flex items-center justify-center gap-2 md:hidden mt-4">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button size="sm" onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Product"}
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}

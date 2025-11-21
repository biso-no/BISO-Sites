"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type UseFormReturn, type WatchObserver, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Check, Edit2, Eye, X } from "lucide-react";
import type { Campus } from "@/lib/types/post";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@repo/ui/components/ui/tabs";
import { EventPreview } from "./event-preview";
import ImageUploadCard from "./image-upload-card";
import { type FormValues, slugify } from "./schema";

type EventSidebarProps = {
  campuses: Campus[];
  departments: Array<{ $id: string; Name: string }>;
  loadingDepartments: boolean;
};

type SlugSource = "en" | "no" | null;
type TitleWatchValue = {
  translations?: {
    en?: { title?: string | null };
    no?: { title?: string | null };
  };
};

const determineSlugUpdate = (enTitle: string, noTitle: string, currentSource: SlugSource) => {
  let newSource = currentSource;
  let newSlug = "";

  if (!currentSource) {
    if (noTitle && !enTitle) {
      newSource = "no";
    } else if (enTitle && !noTitle) {
      newSource = "en";
    }
  } else if (currentSource === "no" && !noTitle && enTitle) {
    newSource = "en";
  } else if (currentSource === "en" && !enTitle && noTitle) {
    newSource = "no";
  }

  if (newSource === "no" && noTitle) {
    newSlug = slugify(noTitle);
  } else if (newSource === "en" && enTitle) {
    newSlug = slugify(enTitle);
  }

  return { newSource, newSlug };
};

const getDepartmentPlaceholder = (
  loadingDepartments: boolean,
  selectedCampus?: Campus,
  t?: ReturnType<typeof useTranslations>
) => {
  if (loadingDepartments) {
    return t?.("editor.placeholders.loading") ?? "";
  }
  if (selectedCampus) {
    return t?.("editor.placeholders.selectDepartmentOptional") ?? "";
  }
  return t?.("editor.placeholders.selectCampusFirst") ?? "";
};

const getSlugSourceLabel = (slugSource: SlugSource, t: ReturnType<typeof useTranslations>) => {
  if (!slugSource) {
    return t("editor.title");
  }
  return slugSource === "no" ? t("editor.norwegian") : t("editor.english");
};

const getSlugDescription = (
  slugSource: SlugSource,
  slugSourceLabel: string,
  t: ReturnType<typeof useTranslations>
) => {
  if (slugSource) {
    return t("editor.slugDescriptionAuto", { source: slugSourceLabel });
  }
  return t("editor.slugDescriptionFallback");
};

const shouldHandleTitleChange = (name?: string) =>
  Boolean(name?.startsWith("translations.")) && Boolean(name?.endsWith(".title"));

const applySlugUpdateFromTitles = (
  value: TitleWatchValue,
  form: UseFormReturn<FormValues>,
  slugSource: SlugSource,
  setSlugSource: (next: SlugSource) => void
) => {
  const enTitle = value.translations?.en?.title || "";
  const noTitle = value.translations?.no?.title || "";
  const currentSlug = form.getValues("slug") || "";

  const hasExistingSlug = currentSlug && currentSlug.length > 0;
  const matchesEn = slugify(enTitle) === currentSlug;
  const matchesNo = slugify(noTitle) === currentSlug;

  if (hasExistingSlug && !slugSource && !matchesEn && !matchesNo) {
    return;
  }

  const { newSource, newSlug } = determineSlugUpdate(enTitle, noTitle, slugSource);

  if (newSource !== slugSource) {
    setSlugSource(newSource);
  }
  if (newSlug) {
    form.setValue("slug", newSlug, { shouldValidate: true });
  }
};

const useSlugAutoUpdate = (
  form: UseFormReturn<FormValues>,
  isEditingSlug: boolean,
  slugSource: SlugSource,
  setSlugSource: (next: SlugSource) => void
) => {
  useEffect(() => {
    if (isEditingSlug) {
      return;
    }

    const handleTitleChange: WatchObserver<FormValues> = (value, { name }) => {
      if (!shouldHandleTitleChange(name)) {
        return;
      }
      applySlugUpdateFromTitles(value, form, slugSource, setSlugSource);
    };

    const subscription = form.watch(handleTitleChange);
    return () => subscription.unsubscribe();
  }, [form, isEditingSlug, setSlugSource, slugSource]);
};

export function EventSidebar({ campuses, departments, loadingDepartments }: EventSidebarProps) {
  const t = useTranslations("adminEvents");
  const form = useFormContext<FormValues>();
  const [previewLocale, setPreviewLocale] = useState<"en" | "no">("en");

  // Slug state
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [slugSource, setSlugSource] = useState<SlugSource>(null);
  const slugInputRef = useRef<HTMLInputElement>(null);

  const selectedCampus = campuses.find(
    (c) => c.$id === form.watch("campus_id")
  );

  const departmentPlaceholder = useMemo(
    () => getDepartmentPlaceholder(loadingDepartments, selectedCampus, t),
    [loadingDepartments, selectedCampus, t]
  );

  const slugSourceLabel = useMemo(
    () => getSlugSourceLabel(slugSource, t),
    [slugSource, t]
  );

  const slugDescription = useMemo(
    () => getSlugDescription(slugSource, slugSourceLabel, t),
    [slugSource, slugSourceLabel, t]
  );

  const slugEditingHint = t("editor.slugEditingHint");

  // Auto-generate slug from title
  useSlugAutoUpdate(form, isEditingSlug, slugSource, setSlugSource);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingSlug && slugInputRef.current) {
      slugInputRef.current.focus();
      slugInputRef.current.select();
    }
  }, [isEditingSlug]);

  const handleSlugKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setIsEditingSlug(false);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsEditingSlug(false);
      const enTitle = form.getValues("translations.en.title");
      const noTitle = form.getValues("translations.no.title");
      const titleToUse = slugSource === "no" ? noTitle : enTitle;
      if (titleToUse) {
        form.setValue("slug", slugify(titleToUse));
      }
    }
  };

  const handleSaveSlug = () => {
    setIsEditingSlug(false);
  };

  const handleCancelSlug = () => {
    setIsEditingSlug(false);
    const enTitle = form.getValues("translations.en.title");
    const noTitle = form.getValues("translations.no.title");
    const titleToUse = slugSource === "no" ? noTitle : enTitle;
    if (titleToUse) {
      form.setValue("slug", slugify(titleToUse));
    }
  };

  return (
    <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
      {/* Event Settings */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Event Settings</CardTitle>
          <CardDescription>Configure status and location</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("form.slug")}</FormLabel>
                <FormControl>
                  {isEditingSlug ? (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder={t("editor.slugPlaceholder")}
                        {...field}
                        className="glass-input flex-1"
                        onKeyDown={handleSlugKeyDown}
                        ref={(e) => {
                          field.ref(e);
                          slugInputRef.current = e;
                        }}
                      />
                      <Button
                        className="h-9 w-9 p-0 text-green-600 hover:bg-green-50 hover:text-green-700"
                        onClick={handleSaveSlug}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Check className="h-4 w-4" />
                        <span className="sr-only">{t("editor.saveSlug")}</span>
                      </Button>
                      <Button
                        className="h-9 w-9 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={handleCancelSlug}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">{t("editor.cancelSlug")}</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-white/40 px-3 py-2">
                      <code className="flex-1 font-mono text-muted-foreground text-sm">
                        {field.value || t("editor.slugFallback")}
                      </code>
                      <Button
                        className="h-7 w-7 p-0"
                        onClick={() => setIsEditingSlug(true)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span className="sr-only">{t("editor.editSlug")}</span>
                      </Button>
                    </div>
                  )}
                </FormControl>
                <FormDescription>
                  {isEditingSlug ? slugEditingHint : slugDescription}
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
                <FormLabel>{t("form.status")}</FormLabel>
                <Select
                  defaultValue={field.value}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger className="glass-input">
                      <SelectValue placeholder={t("editor.selectStatus")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="draft">{t("status.draft")}</SelectItem>
                    <SelectItem value="published">
                      {t("status.published")}
                    </SelectItem>
                    <SelectItem value="cancelled">
                      {t("status.cancelled")}
                    </SelectItem>
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
                <FormLabel>{t("form.campus")}</FormLabel>
                <Select
                  defaultValue={field.value}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger className="glass-input">
                      <SelectValue placeholder={t("editor.selectCampus")} />
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
                    {t("editor.selectedCampus", {
                      name: selectedCampus.name,
                    })}
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="department_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Department (optional)</FormLabel>
                <Select
                  disabled={!form.watch("campus_id") || loadingDepartments}
                  onValueChange={(value) => field.onChange(value)}
                  value={field.value ?? undefined}
                >
                  <FormControl>
                    <SelectTrigger className="glass-input">
                      <SelectValue placeholder={departmentPlaceholder} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.$id} value={dept.$id}>
                        {dept.Name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  {!form.watch("campus_id") &&
                    t("editor.selectCampusDepartmentHint")}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Event Images */}
      <FormField
        control={form.control}
        name="metadata.images"
        render={({ field }) => (
          <FormItem>
            <ImageUploadCard
              images={field.value || []}
              onChange={(next) => {
                field.onChange(next);
                // Update the image field with the primary image
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
              {t("editor.livePreviewTitle")}
            </CardTitle>
            <Tabs
              className="w-auto"
              onValueChange={(value) => setPreviewLocale(value as "en" | "no")}
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
          <CardDescription>{t("editor.livePreviewDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <EventPreview
            data={{
              ...form.watch(),
              image: form.watch("metadata.images")?.[0] || "",
            }}
            locale={previewLocale}
          />
        </CardContent>
      </Card>
    </div>
  );
}

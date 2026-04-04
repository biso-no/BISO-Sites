"use client";

import { Button } from "@repo/ui/components/ui/button";
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
import { Check, Edit2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type UseFormReturn,
  useFormContext,
  type WatchObserver,
} from "react-hook-form";
import { CoverImageUpload } from "@/components/forms/CoverImageUpload";
import { FormSection } from "@/components/forms/FormSection";
import type { Campus } from "@/lib/types/post";
import { type FormValues, slugify } from "./schema";

interface EventSidebarProps {
  campuses: Campus[];
  departments: Array<{ $id: string; Name: string }>;
  loadingDepartments: boolean;
}

type SlugSource = "en" | "no" | null;

// ── Slug helpers ─────────────────────────────────────────────────────────────

function determineSlugUpdate(
  enTitle: string,
  noTitle: string,
  currentSource: SlugSource
): { newSource: SlugSource; newSlug: string } {
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
}

interface TitleWatchValue {
  translations?: {
    en?: { title?: string | null };
    no?: { title?: string | null };
  };
}

function applySlugUpdate(
  value: TitleWatchValue,
  form: UseFormReturn<FormValues>,
  slugSource: SlugSource,
  setSlugSource: (next: SlugSource) => void
) {
  const enTitle = value.translations?.en?.title ?? "";
  const noTitle = value.translations?.no?.title ?? "";
  const currentSlug = form.getValues("slug") ?? "";
  const matchesEn = slugify(enTitle) === currentSlug;
  const matchesNo = slugify(noTitle) === currentSlug;

  if (currentSlug && !slugSource && !matchesEn && !matchesNo) {
    return;
  }

  const { newSource, newSlug } = determineSlugUpdate(
    enTitle,
    noTitle,
    slugSource
  );
  if (newSource !== slugSource) {
    setSlugSource(newSource);
  }
  if (newSlug) {
    form.setValue("slug", newSlug, { shouldValidate: true });
  }
}

function useSlugAutoUpdate(
  form: UseFormReturn<FormValues>,
  isEditingSlug: boolean,
  slugSource: SlugSource,
  setSlugSource: (next: SlugSource) => void
) {
  useEffect(() => {
    if (isEditingSlug) {
      return;
    }
    const handler: WatchObserver<FormValues> = (value, { name }) => {
      if (!(name?.startsWith("translations.") && name.endsWith(".title"))) {
        return;
      }
      applySlugUpdate(value, form, slugSource, setSlugSource);
    };
    const sub = form.watch(handler);
    return () => sub.unsubscribe();
  }, [form, isEditingSlug, setSlugSource, slugSource]);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EventSidebar({
  campuses,
  departments,
  loadingDepartments,
}: EventSidebarProps) {
  const t = useTranslations("adminEvents");
  const form = useFormContext<FormValues>();

  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [slugSource, setSlugSource] = useState<SlugSource>(null);
  const slugInputRef = useRef<HTMLInputElement>(null);

  const selectedCampus = campuses.find(
    (c) => c.$id === form.watch("campus_id")
  );

  const departmentPlaceholder = useMemo(() => {
    if (loadingDepartments) {
      return t("editor.placeholders.loading");
    }
    if (selectedCampus) {
      return t("editor.placeholders.selectDepartmentOptional");
    }
    return t("editor.placeholders.selectCampusFirst");
  }, [loadingDepartments, selectedCampus, t]);

  useSlugAutoUpdate(form, isEditingSlug, slugSource, setSlugSource);

  useEffect(() => {
    if (isEditingSlug) {
      slugInputRef.current?.focus();
    }
  }, [isEditingSlug]);

  const cancelSlugEdit = () => {
    setIsEditingSlug(false);
    const en = form.getValues("translations.en.title");
    const no = form.getValues("translations.no.title");
    const source = slugSource === "no" ? no : en;
    if (source) {
      form.setValue("slug", slugify(source));
    }
  };

  return (
    <div className="space-y-5 lg:sticky lg:top-[72px] lg:self-start">
      {/* Status & routing */}
      <FormSection
        subtitle="Status, slug, campus"
        title={t("form.settings") || "Settings"}
      >
        <div className="space-y-4">
          {/* Status */}
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
                    <SelectTrigger>
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

          {/* Slug */}
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
                        aria-describedby="slug-hint"
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            setIsEditingSlug(false);
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelSlugEdit();
                          }
                        }}
                        ref={(el) => {
                          field.ref(el);
                          slugInputRef.current = el;
                        }}
                      />
                      <Button
                        className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50"
                        onClick={() => setIsEditingSlug(false)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Check className="h-4 w-4" />
                        <span className="sr-only">{t("editor.saveSlug")}</span>
                      </Button>
                      <Button
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                        onClick={cancelSlugEdit}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">
                          {t("editor.cancelSlug")}
                        </span>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                      <code
                        className="flex-1 truncate font-mono text-muted-foreground text-xs"
                        title={field.value}
                      >
                        {field.value || t("editor.slugFallback")}
                      </code>
                      <Button
                        className="h-6 w-6 shrink-0 p-0"
                        onClick={() => setIsEditingSlug(true)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Edit2 className="h-3 w-3" />
                        <span className="sr-only">{t("editor.editSlug")}</span>
                      </Button>
                    </div>
                  )}
                </FormControl>
                <FormDescription id="slug-hint">
                  {isEditingSlug
                    ? t("editor.slugEditingHint")
                    : slugSource
                      ? t("editor.slugDescriptionAuto", {
                          source:
                            slugSource === "no"
                              ? t("editor.norwegian")
                              : t("editor.english"),
                        })
                      : t("editor.slugDescriptionFallback")}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Campus */}
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
                    <SelectTrigger>
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
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Department */}
          <FormField
            control={form.control}
            name="department_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t("form.department") || "Department"}{" "}
                  <span className="font-normal text-muted-foreground text-xs">
                    (optional)
                  </span>
                </FormLabel>
                <Select
                  disabled={!form.watch("campus_id") || loadingDepartments}
                  onValueChange={field.onChange}
                  value={field.value ?? undefined}
                >
                  <FormControl>
                    <SelectTrigger>
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
        </div>
      </FormSection>

      {/* Cover image */}
      <FormSection
        subtitle="Drag and drop or click to upload"
        title="Cover Image"
      >
        <FormField
          control={form.control}
          name="metadata.images"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <CoverImageUpload
                  images={field.value ?? []}
                  label=""
                  onChange={(next) => {
                    field.onChange(next);
                    form.setValue("image", next[0] ?? "");
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </FormSection>
    </div>
  );
}

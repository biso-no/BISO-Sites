"use client";

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
import { Check, Edit2, Eye, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useFormContext } from "react-hook-form";
import type { Campus } from "@/lib/types/post";
import { EventPreview } from "./event-preview";
import ImageUploadCard from "./image-upload-card";
import { slugify } from "./schema";
import type { FormValues } from "./schema";

type EventSidebarProps = {
  campuses: Campus[];
  departments: Array<{ $id: string; Name: string }>;
  loadingDepartments: boolean;
};

export function EventSidebar({
  campuses,
  departments,
  loadingDepartments,
}: EventSidebarProps) {
  const t = useTranslations("adminEvents");
  const form = useFormContext<FormValues>();
  const [previewLocale, setPreviewLocale] = React.useState<"en" | "no">("en");

  // Slug state
  const [isEditingSlug, setIsEditingSlug] = React.useState(false);
  const [slugSource, setSlugSource] = React.useState<"en" | "no" | null>(null);
  const slugInputRef = React.useRef<HTMLInputElement>(null);

  const selectedCampus = campuses.find(
    (c) => c.$id === form.watch("campus_id")
  );

  const departmentPlaceholder = loadingDepartments
    ? t("editor.placeholders.loading")
    : selectedCampus
      ? t("editor.placeholders.selectDepartmentOptional")
      : t("editor.placeholders.selectCampusFirst");

  const slugSourceLabel = slugSource
    ? slugSource === "no"
      ? t("editor.norwegian")
      : t("editor.english")
    : t("editor.title");
  
  const slugDescription = slugSource
    ? t("editor.slugDescriptionAuto", { source: slugSourceLabel })
    : t("editor.slugDescriptionFallback");
    
  const slugEditingHint = t("editor.slugEditingHint");

  // Auto-generate slug from title
  React.useEffect(() => {
    if (isEditingSlug) {
      return;
    }
    // Check if we should auto-generate (only if slug is empty or we are tracking source)
    // Note: logic slightly modified from original to work without "event" prop check for existing
    // We can check if form is dirty or similar, but here we rely on the watch.
    // Actually original checked "if (event) return".
    // If we don't pass event prop, we don't know if it's new or edit.
    // But we can check if slug has a value initially?
    // The form default values are set in parent.
    
    // For now, let's replicate the watch logic.
    // We need to know if it's an existing event to avoid overwriting slug.
    // But since we don't have that info, maybe we can check if slug is empty?
    // Or just rely on the user manually editing if they want to change it.
    
    const subscription = form.watch((value, { name }) => {
      if (!name?.startsWith("translations.")) {
        return;
      }
      if (!name?.endsWith(".title")) {
        return;
      }

      const enTitle = value.translations?.en?.title || "";
      const noTitle = value.translations?.no?.title || "";
      const currentSlug = form.getValues("slug");

      // If slug is already set and we haven't established a source, don't overwrite
      // unless it looks like we are just starting (e.g. empty slug)
      if (currentSlug && !slugSource && currentSlug.length > 0) {
         // If the slug matches one of the titles slugified, maybe we can adopt it?
         // For safety, let's only auto-generate if slug is empty or we are already tracking.
         if (slugify(enTitle) !== currentSlug && slugify(noTitle) !== currentSlug) {
             return;
         }
      }

      if (!slugSource) {
        if (noTitle && !enTitle) {
          setSlugSource("no");
          form.setValue("slug", slugify(noTitle), { shouldValidate: true });
        } else if (enTitle && !noTitle) {
          setSlugSource("en");
          form.setValue("slug", slugify(enTitle), { shouldValidate: true });
        }
      } else if (slugSource === "no") {
        if (noTitle) {
          form.setValue("slug", slugify(noTitle), { shouldValidate: true });
        } else if (!noTitle && enTitle) {
          setSlugSource("en");
          form.setValue("slug", slugify(enTitle), { shouldValidate: true });
        }
      } else if (slugSource === "en") {
        if (enTitle) {
          form.setValue("slug", slugify(enTitle), { shouldValidate: true });
        } else if (!enTitle && noTitle) {
          setSlugSource("no");
          form.setValue("slug", slugify(noTitle), { shouldValidate: true });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [form, isEditingSlug, slugSource]);

  // Focus input when entering edit mode
  React.useEffect(() => {
    if (isEditingSlug && slugInputRef.current) {
      slugInputRef.current.focus();
      slugInputRef.current.select();
    }
  }, [isEditingSlug]);

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
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            setIsEditingSlug(false);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            setIsEditingSlug(false);
                            const enTitle = form.getValues(
                              "translations.en.title"
                            );
                            const noTitle = form.getValues(
                              "translations.no.title"
                            );
                            const titleToUse =
                              slugSource === "no" ? noTitle : enTitle;
                            if (titleToUse) {
                              form.setValue("slug", slugify(titleToUse));
                            }
                          }
                        }}
                        ref={(e) => {
                          field.ref(e);
                          slugInputRef.current = e;
                        }}
                      />
                      <Button
                        className="h-9 w-9 p-0 text-green-600 hover:bg-green-50 hover:text-green-700"
                        onClick={() => setIsEditingSlug(false)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Check className="h-4 w-4" />
                        <span className="sr-only">{t("editor.saveSlug")}</span>
                      </Button>
                      <Button
                        className="h-9 w-9 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => {
                          setIsEditingSlug(false);
                          const enTitle = form.getValues(
                            "translations.en.title"
                          );
                          const noTitle = form.getValues(
                            "translations.no.title"
                          );
                          const titleToUse =
                            slugSource === "no" ? noTitle : enTitle;
                          if (titleToUse) {
                            form.setValue("slug", slugify(titleToUse));
                          }
                        }}
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

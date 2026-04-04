"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Campus, Departments, News } from "@repo/api/types/appwrite";
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
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createPostFromForm, updatePostFromForm } from "@/app/actions/admin";
import { CharacterCount } from "@/components/forms/CharacterCount";
import { CoverImageUpload } from "@/components/forms/CoverImageUpload";
import { DraftRestoreBanner } from "@/components/forms/DraftRestoreBanner";
import { FormSection } from "@/components/forms/FormSection";
import { type Locale, LocaleTabGroup } from "@/components/forms/LocaleTabGroup";
import { SaveBar, type SaveStatus } from "@/components/forms/SaveBar";
import { NewsPreviewPane } from "@/components/preview/NewsPreviewPane";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useAutosave } from "@/hooks/useAutosave";
import { useDirtyWarning } from "@/hooks/useDirtyWarning";
import { toast } from "@/lib/hooks/use-toast";

const TITLE_MAX = 100;

const postSchema = z.object({
  translations: z.object({
    en: z.object({
      title: z
        .string()
        .min(5, "English title must be at least 5 characters")
        .max(TITLE_MAX, `Title must be ${TITLE_MAX} characters or fewer`),
      description: z
        .string()
        .min(50, "English content must be at least 50 characters")
        .max(50_000),
    }),
    no: z.object({
      title: z
        .string()
        .min(5, "Norwegian title must be at least 5 characters")
        .max(TITLE_MAX, `Title must be ${TITLE_MAX} characters or fewer`),
      description: z
        .string()
        .min(50, "Norwegian content must be at least 50 characters")
        .max(50_000),
    }),
  }),
  status: z.enum(["draft", "published"]),
  department: z.string().min(1, "Department is required"),
  campus: z.string().min(1, "Campus is required"),
  image: z.string().optional(),
  sticky: z.boolean().optional(),
  author: z.string().optional(),
});

type PostFormValues = z.infer<typeof postSchema>;

interface PostEditorProps {
  campuses: Campus[];
  departments: Departments[];
  post?: News | null;
}

function getInitialValues(
  post: News | null | undefined,
  locale: string
): PostFormValues {
  if (!post) {
    return {
      translations: {
        en: { title: "", description: "" },
        no: { title: "", description: "" },
      },
      status: "draft",
      department: "",
      campus: "",
      image: "",
      sticky: false,
      author: "",
    };
  }

  const refs = Array.isArray(post.translation_refs)
    ? post.translation_refs
    : [];
  const getRef = (loc: string) =>
    refs.find((r) => typeof r !== "string" && r.locale === loc);

  const enRef = getRef("en") ?? getRef(locale);
  const noRef = getRef("no");

  return {
    translations: {
      en: {
        title: (typeof enRef === "string" ? "" : enRef?.title) ?? "",
        description:
          (typeof enRef === "string" ? "" : enRef?.description) ?? "",
      },
      no: {
        title: (typeof noRef === "string" ? "" : noRef?.title) ?? "",
        description:
          (typeof noRef === "string" ? "" : noRef?.description) ?? "",
      },
    },
    status: (post.status as "draft" | "published") ?? "draft",
    department:
      typeof post.department === "string"
        ? post.department
        : (post.department?.$id ?? ""),
    campus:
      typeof post.campus === "string" ? post.campus : (post.campus?.$id ?? ""),
    image: post.image ?? "",
    sticky: post.sticky ?? false,
    author: post.author ?? "",
  };
}

export default function PostEditor({
  post,
  departments,
  campuses,
}: PostEditorProps) {
  const router = useRouter();
  const t = useTranslations("adminPosts");
  const locale = useLocale();

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [activeLocale, setActiveLocale] = useState<Locale>("en");
  const [pendingDraft, setPendingDraft] = useState<{
    values: PostFormValues;
    savedAt: Date;
  } | null>(null);

  const isEditing = !!post?.$id;
  const storageKey = `post:${post?.$id ?? "new"}`;

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: getInitialValues(post, locale),
    mode: "onBlur",
  });

  const { isDirty, isSubmitting } = form.formState;

  const {
    lastSaved,
    enabled: autosaveEnabled,
    setEnabled: setAutosave,
    clearDraft,
  } = useAutosave<PostFormValues>({
    storageKey,
    values: form.watch(),
    isDirty,
    onRestoreDraft: (draft) =>
      setPendingDraft({ values: draft, savedAt: new Date() }),
  });

  useDirtyWarning({ isDirty, isSubmitting });

  const handleSubmit = async (values: PostFormValues) => {
    setSaveStatus("saving");
    try {
      const payload = {
        translations: values.translations,
        status: values.status,
        campus_id: values.campus,
        department_id: values.department || undefined,
        image: values.image || undefined,
        sticky: values.sticky,
        author: values.author || undefined,
      };

      if (isEditing && post?.$id) {
        await updatePostFromForm(post.$id, payload);
        toast({
          title: t("messages.successTitle"),
          description: t("messages.updateSuccess"),
        });
      } else {
        await createPostFromForm(payload);
        toast({
          title: t("messages.successTitle"),
          description: t("messages.createSuccess"),
        });
      }

      clearDraft();
      setSaveStatus("saved");
      router.push("/posts");
    } catch (error) {
      console.error(error);
      setSaveStatus("error");
      toast({
        title: t("messages.errorTitle"),
        description: t("messages.saveError"),
        variant: "destructive",
      });
    }
  };

  const handleSave = form.handleSubmit(handleSubmit);
  const handleCancel = () => {
    if (isDirty) {
      const ok = window.confirm(
        "You have unsaved changes. Leave without saving?"
      );
      if (!ok) {
        return;
      }
    }
    router.back();
  };

  const formValues = form.watch();
  const enTitle = formValues.translations.en.title;
  const noTitle = formValues.translations.no.title;
  const enDesc = formValues.translations.en.description;
  const noDesc = formValues.translations.no.description;

  const localeStatus: Record<Locale, "complete" | "partial" | "empty"> = {
    en:
      enTitle.length >= 5 && enDesc.length >= 50
        ? "complete"
        : enTitle.length > 0
          ? "partial"
          : "empty",
    no:
      noTitle.length >= 5 && noDesc.length >= 50
        ? "complete"
        : noTitle.length > 0
          ? "partial"
          : "empty",
  };

  const _oppositeLocale: Locale = activeLocale === "en" ? "no" : "en";
  const activeTitle = activeLocale === "en" ? enTitle : noTitle;

  const selectedDept = departments.find((d) => d.$id === formValues.department);
  const selectedCampus = campuses.find((c) => c.$id === formValues.campus);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Breadcrumb */}
      <div className="border-border/40 border-b bg-background/80 px-6 py-3 backdrop-blur-sm">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/posts">
                {t("breadcrumb.posts") || "Posts"}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {isEditing
                  ? enTitle || t("editor.edit") || "Edit Post"
                  : t("editor.newPost") || "New Post"}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Draft restore banner */}
      {pendingDraft && (
        <div className="px-6 pt-4">
          <DraftRestoreBanner
            onDiscard={() => {
              clearDraft();
              setPendingDraft(null);
            }}
            onRestore={() => {
              form.reset(pendingDraft.values);
              setPendingDraft(null);
            }}
            savedAt={pendingDraft.savedAt}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <PreviewPanel
          renderPreview={(previewLocale) => (
            <NewsPreviewPane
              data={{
                status: formValues.status,
                image: formValues.image || undefined,
                author: formValues.author || undefined,
                sticky: formValues.sticky,
                translations: formValues.translations,
                campusName: selectedCampus?.name,
                departmentName: selectedDept?.Name,
              }}
              locale={previewLocale}
            />
          )}
        >
          <Form {...form}>
            <form
              className="space-y-5 px-6 py-6 lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:space-y-0"
              onSubmit={handleSave}
            >
              {/* LEFT — article content */}
              <div className="space-y-5">
                {/* Locale switcher */}
                <div className="flex items-center justify-between">
                  <LocaleTabGroup
                    activeLocale={activeLocale}
                    onChange={setActiveLocale}
                    status={localeStatus}
                  />
                  <Button
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      // Placeholder — could wire AI translation here
                      toast({
                        title: "Translation feature",
                        description:
                          "Use the AI copilot to translate content between languages.",
                      });
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Auto-translate
                  </Button>
                </div>

                <FormSection
                  subtitle="The title that appears at the top of the article"
                  title="Headline"
                >
                  <FormField
                    control={form.control}
                    name={`translations.${activeLocale}.title`}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel aria-required="true">
                            {t("form.title")}{" "}
                            <span aria-hidden className="text-destructive">
                              *
                            </span>
                          </FormLabel>
                          <CharacterCount
                            current={activeTitle.length}
                            max={TITLE_MAX}
                          />
                        </div>
                        <FormControl>
                          <Input
                            placeholder={
                              activeLocale === "en"
                                ? "Article title in English"
                                : "Artikkeltittel på norsk"
                            }
                            {...field}
                            aria-required="true"
                            className="font-medium text-lg"
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </FormSection>

                <FormSection
                  subtitle="The full article body. Supports rich text formatting."
                  title="Content"
                >
                  <FormField
                    control={form.control}
                    name={`translations.${activeLocale}.description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">
                          Article content
                        </FormLabel>
                        <FormControl>
                          <RichTextEditor
                            content={field.value ?? ""}
                            editable
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </FormSection>
              </div>

              {/* RIGHT — settings sidebar */}
              <div className="space-y-5 lg:sticky lg:top-[72px] lg:self-start">
                <FormSection
                  subtitle="Status and visibility"
                  title="Publishing"
                >
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("form.status")}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t("form.selectStatus")}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="draft">
                                {t("status.draft")}
                              </SelectItem>
                              <SelectItem value="published">
                                {t("status.published")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sticky"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div>
                            <FormLabel className="mb-0">Pin to top</FormLabel>
                            <p className="text-muted-foreground text-xs">
                              Keeps this post at the top of the news feed
                            </p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value ?? false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="author"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Author</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Author name"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </FormSection>

                <FormSection
                  subtitle="Campus and department"
                  title="Organisation"
                >
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="campus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("form.campus")}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t("form.selectCampus")}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {campuses.map((c) => (
                                <SelectItem key={c.$id} value={c.$id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("form.department")}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t("form.selectDepartment")}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {departments.map((d) => (
                                <SelectItem key={d.$id} value={d.$id}>
                                  {d.Name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </FormSection>

                <FormSection title="Cover Image">
                  <FormField
                    control={form.control}
                    name="image"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <CoverImageUpload
                            images={field.value ? [field.value] : []}
                            label=""
                            onChange={(next) => field.onChange(next[0] ?? "")}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </FormSection>
              </div>
            </form>
          </Form>
        </PreviewPanel>
      </div>

      {/* Sticky save bar */}
      <SaveBar
        autosaveEnabled={autosaveEnabled}
        isDirty={isDirty}
        isSubmitting={isSubmitting}
        lastSaved={lastSaved}
        onAutosaveToggle={setAutosave}
        onCancel={handleCancel}
        onSave={handleSave}
        saveLabel={isEditing ? t("form.save") : t("form.save") || "Publish"}
        status={saveStatus}
      />
    </div>
  );
}

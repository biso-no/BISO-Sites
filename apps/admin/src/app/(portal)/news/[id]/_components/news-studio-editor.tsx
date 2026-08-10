"use client";

import type { Campus, Departments } from "@repo/api/types/appwrite";
import { ArrowLeft, ArrowRight, Check, Circle, Save, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { listDepartmentsForCampus } from "../../../_actions/lookups";
import { createNews, updateNews } from "../../../_actions/news";
import { type NewsFormValues, newsSchema } from "../../../_actions/schemas";
import { ImageUploadField } from "../../../_components/image-upload-field";
import { NewsArticleStep } from "./news-article-step";
import { NewsStudioPreview } from "./news-studio-preview";
import {
  createNewsStudioDefaults,
  getNewsSavedValues,
  getNewsStepCompletion,
  type NewsLocale,
  type NewsWithTranslations,
  refreshNewsDepartments,
} from "./news-studio-state";

interface NewsStudioLabels {
  author: string;
  back: string;
  body: string;
  campus: string;
  category: string;
  coverImage: string;
  discard: string;
  locale: string;
  preview: string;
  publish: string;
  publishSuccess: string;
  saveDraft: string;
  saveError: string;
  saveSuccess: string;
  status: string;
  title: string;
}

interface NewsStudioEditorProps {
  allowedDepartmentIds?: string[];
  article: NewsWithTranslations | null;
  campuses: Campus[];
  canChangeCampus?: boolean;
  defaultCampusId: string;
  initialDepartments: Departments[];
  isNew: boolean;
  labels: NewsStudioLabels;
}

interface StepProps {
  locale: NewsLocale;
  setValue: SetNewsValue;
  values: NewsFormValues;
}

interface EssentialsStepProps extends StepProps {
  campuses: Campus[];
  canChangeCampus: boolean;
  departments: Departments[];
  onCampusChange: (campusId: string) => Promise<void>;
}

interface MediaVisibilityStepProps extends StepProps {
  campusName: string;
  departmentName: string;
}

interface ReviewStepProps extends StepProps {
  campusName: string;
  departmentName: string;
  labels: NewsStudioLabels;
  onPublish: () => Promise<void>;
  onSaveDraft: () => Promise<void>;
  pendingStatus: NewsFormValues["status"] | null;
}

type SetNewsValue = <Key extends keyof NewsFormValues>(
  key: Key,
  value: NewsFormValues[Key]
) => void;

const NEWS_STEPS = [
  "Essentials",
  "Article",
  "Media & Visibility",
  "Review",
] as const;

const CATEGORY_OPTIONS = [
  { label: "No category", value: "" },
  { label: "General", value: "general" },
  { label: "Announcement", value: "announcement" },
  { label: "Press", value: "press" },
  { label: "Event recap", value: "event" },
] as const;

const inputClass =
  "w-full rounded-lg border border-slate-300/80 bg-white/75 px-3 py-2.5 text-sm text-[#07111f] outline-none transition placeholder:text-slate-400 focus:border-[#3DA9E0] focus:bg-white focus:ring-2 focus:ring-[#3DA9E0]/15";

const generateSlug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

function StudioField({
  children,
  help,
  htmlFor,
  label,
  required,
}: {
  children: React.ReactNode;
  help?: string;
  htmlFor: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <label
        className="flex items-center gap-2 font-medium text-[11px] text-slate-500 uppercase tracking-[0.12em]"
        htmlFor={htmlFor}
      >
        {label}
        {required && <span className="text-red-500">*</span>}
        {help && (
          <span className="ml-auto text-[10px] normal-case tracking-normal">
            {help}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function NewsStudioHeader({
  articleTitle,
  isNew,
  labels,
  onDiscard,
  onPublish,
  onSaveDraft,
  pendingStatus,
}: {
  articleTitle: string;
  isNew: boolean;
  labels: NewsStudioLabels;
  onDiscard: () => void;
  onPublish: () => Promise<void>;
  onSaveDraft: () => Promise<void>;
  pendingStatus: NewsFormValues["status"] | null;
}) {
  return (
    <header className="flex items-center gap-3 border-slate-200 border-b bg-[#faf7f2] px-4 py-4 md:px-8">
      <button
        aria-label={labels.back}
        className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:text-[#001731]"
        onClick={onDiscard}
        type="button"
      >
        <ArrowLeft size={16} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[#3DA9E0] text-[11px] uppercase tracking-[0.16em]">
          BISO news publishing studio
        </p>
        <h1 className="truncate font-light text-2xl tracking-tight md:text-3xl">
          {isNew ? "New article" : articleTitle || "Edit article"}
        </h1>
      </div>
      <div className="hidden items-center gap-2 md:flex">
        <button
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-600 text-sm transition hover:text-[#001731]"
          onClick={onDiscard}
          type="button"
        >
          {labels.discard}
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-[#001731] text-sm transition hover:border-[#3DA9E0]/50 disabled:opacity-60"
          disabled={pendingStatus !== null}
          onClick={onSaveDraft}
          type="button"
        >
          <Save size={15} />
          {pendingStatus === "draft" ? "Saving..." : labels.saveDraft}
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-[#001731] px-4 py-2 font-medium text-sm text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 disabled:opacity-60"
          disabled={pendingStatus !== null}
          onClick={onPublish}
          type="button"
        >
          <Send size={15} />
          {pendingStatus === "published" ? "Publishing..." : labels.publish}
        </button>
      </div>
    </header>
  );
}

function NewsStudioStepRail({
  completedSteps,
  dirty,
  locale,
  onLocaleChange,
  onStepChange,
  step,
}: {
  completedSteps: readonly boolean[];
  dirty: boolean;
  locale: NewsLocale;
  onLocaleChange: (locale: NewsLocale) => void;
  onStepChange: (step: number) => void;
  step: number;
}) {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 border-slate-200 border-b bg-[#faf7f2]/90 px-4 py-3 backdrop-blur-xl md:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {NEWS_STEPS.map((name, index) => {
          const active = index === step;
          const complete = completedSteps[index] ?? false;

          return (
            <button
              aria-current={active ? "step" : undefined}
              className="inline-flex shrink-0 items-center gap-2 rounded-full px-2 py-1.5 pr-3 text-xs transition"
              key={name}
              onClick={() => onStepChange(index)}
              style={
                active
                  ? { background: "#001731", color: "#fff" }
                  : { color: complete ? "#15803d" : "#64748b" }
              }
              type="button"
            >
              <span
                className="grid h-6 w-6 place-items-center rounded-full border text-[10px]"
                style={{
                  background: complete ? "#16a34a" : "#fff",
                  borderColor: complete ? "#16a34a" : "rgba(100,116,139,0.25)",
                  color: complete ? "#fff" : "#001731",
                }}
              >
                {complete ? (
                  <Check size={12} />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              {name}
            </button>
          );
        })}
      </div>
      {dirty && (
        <span className="hidden items-center gap-1.5 text-slate-500 text-xs sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#F7D64A]" />
          Unsaved
        </span>
      )}
      <fieldset className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-slate-100 p-1">
        <legend className="sr-only">Article language</legend>
        {(["no", "en"] as const).map((item) => (
          <button
            aria-pressed={locale === item}
            className="rounded-md px-3 py-1.5 font-medium text-xs"
            key={item}
            onClick={() => onLocaleChange(item)}
            style={
              locale === item
                ? { background: "#fff", color: "#001731" }
                : { color: "#64748b" }
            }
            type="button"
          >
            {item.toUpperCase()}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

function NewsStudioFooter({
  labels,
  onBack,
  onContinue,
  onPublish,
  onSaveDraft,
  pendingStatus,
  step,
}: {
  labels: NewsStudioLabels;
  onBack: () => void;
  onContinue: () => void;
  onPublish: () => Promise<void>;
  onSaveDraft: () => Promise<void>;
  pendingStatus: NewsFormValues["status"] | null;
  step: number;
}) {
  const progress = ((step + 1) / NEWS_STEPS.length) * 100;

  return (
    <footer className="sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-slate-200 border-t bg-[#faf7f2]/92 px-4 py-3 backdrop-blur-xl md:px-8">
      <div className="hidden w-40 sm:block">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-[#3DA9E0] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] text-slate-500 uppercase tracking-[0.12em]">
          {NEWS_STEPS[step]}
        </p>
      </div>
      <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
        {step > 0 && (
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-600 text-sm"
            onClick={onBack}
            type="button"
          >
            Back
          </button>
        )}
        {step < NEWS_STEPS.length - 1 && (
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-[#001731] px-4 py-2 font-medium text-sm text-white"
            onClick={onContinue}
            type="button"
          >
            Continue
            <ArrowRight size={15} />
          </button>
        )}
        <button
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-[#001731] text-sm disabled:opacity-60 sm:flex-none"
          disabled={pendingStatus !== null}
          onClick={onSaveDraft}
          type="button"
        >
          <Save size={15} />
          {pendingStatus === "draft" ? "Saving..." : labels.saveDraft}
        </button>
        <button
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#001731] px-4 py-2 font-medium text-sm text-white disabled:opacity-60 sm:flex-none"
          disabled={pendingStatus !== null}
          onClick={onPublish}
          type="button"
        >
          <Send size={15} />
          {pendingStatus === "published" ? "Publishing..." : labels.publish}
        </button>
      </div>
    </footer>
  );
}

function NewsEssentialsStep({
  campuses,
  canChangeCampus,
  departments,
  locale,
  onCampusChange,
  setValue,
  values,
}: EssentialsStepProps) {
  const titleKey = locale === "no" ? "title_no" : "title_en";
  const languageLabel = locale === "no" ? "Norwegian" : "English";
  const titleId = `news-title-${locale}`;

  return (
    <div className="space-y-7">
      <StudioField
        help={`${languageLabel} · ${locale.toUpperCase()}`}
        htmlFor={titleId}
        label="Headline"
        required
      >
        <input
          className="w-full bg-transparent font-light text-5xl leading-none tracking-tight outline-none placeholder:text-slate-300 md:text-6xl"
          id={titleId}
          onBlur={() => {
            if (!values.slug) {
              setValue(
                "slug",
                generateSlug(values.title_no || values.title_en)
              );
            }
          }}
          onChange={(event) => setValue(titleKey, event.target.value)}
          placeholder="A headline worth opening..."
          value={values[titleKey]}
        />
      </StudioField>

      <StudioField htmlFor="news-slug" label="Article URL" required>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/70 px-3 py-2 font-mono text-slate-500 text-xs">
          <span>biso.no/news/</span>
          <input
            className="min-w-0 flex-1 bg-transparent text-[#001731] outline-none"
            id="news-slug"
            onChange={(event) => setValue("slug", event.target.value)}
            placeholder="article-slug"
            value={values.slug}
          />
        </div>
      </StudioField>

      <div className="grid gap-5 md:grid-cols-2">
        <StudioField htmlFor="news-author" label="Author">
          <input
            className={inputClass}
            id="news-author"
            onChange={(event) => setValue("author", event.target.value || null)}
            placeholder="BISO"
            value={values.author ?? ""}
          />
        </StudioField>
        <StudioField htmlFor="news-category" label="Category">
          <select
            className={inputClass}
            id="news-category"
            onChange={(event) =>
              setValue("category", event.target.value || null)
            }
            value={values.category ?? ""}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </StudioField>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <StudioField htmlFor="news-campus" label="Campus" required>
          <select
            className={inputClass}
            disabled={!canChangeCampus}
            id="news-campus"
            onChange={async (event) => {
              await onCampusChange(event.target.value);
            }}
            value={values.campus_id}
          >
            <option value="">Select campus</option>
            {campuses.map((campus) => (
              <option key={campus.$id} value={campus.$id}>
                {campus.name}
              </option>
            ))}
          </select>
        </StudioField>
        <StudioField htmlFor="news-department" label="Department">
          <select
            className={inputClass}
            disabled={departments.length === 0}
            id="news-department"
            onChange={(event) =>
              setValue("department_id", event.target.value || null)
            }
            value={values.department_id ?? ""}
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.$id} value={department.$id}>
                {department.Name}
              </option>
            ))}
          </select>
        </StudioField>
      </div>
    </div>
  );
}

function NewsMediaVisibilityStep({
  campusName,
  departmentName,
  setValue,
  values,
}: MediaVisibilityStepProps) {
  return (
    <div className="space-y-7">
      <div>
        <p className="font-medium text-[#3DA9E0] text-[11px] uppercase tracking-[0.14em]">
          Media & Visibility
        </p>
        <h2 className="mt-2 font-light text-3xl tracking-tight">
          Shape how the story is discovered
        </h2>
      </div>

      <StudioField htmlFor="news-cover-image" label="Cover image">
        <div>
          <ImageUploadField
            inputId="news-cover-image"
            label="Cover image"
            onChange={(url) => setValue("image", url)}
            value={values.image ?? null}
          />
        </div>
      </StudioField>

      <button
        aria-pressed={values.sticky}
        className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white/75 p-4 text-left transition hover:border-[#3DA9E0]/50"
        onClick={() => setValue("sticky", !values.sticky)}
        type="button"
      >
        <span
          className="relative h-6 w-11 shrink-0 rounded-full transition"
          style={{ background: values.sticky ? "#001731" : "#cbd5e1" }}
        >
          <span
            className="absolute top-1 h-4 w-4 rounded-full bg-white transition-all"
            style={{ left: values.sticky ? "1.5rem" : "0.25rem" }}
          />
        </span>
        <span>
          <span className="block font-medium text-sm">Sticky article</span>
          <span className="mt-1 block text-slate-500 text-xs">
            Keep this story prominent in news listings while it is relevant.
          </span>
        </span>
      </button>

      <div className="rounded-xl border border-slate-200 bg-[#001731] p-5 text-white">
        <p className="font-medium text-[11px] text-white/60 uppercase tracking-[0.14em]">
          Current publishing scope
        </p>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-white/50">Campus</dt>
            <dd className="mt-1 font-medium">{campusName}</dd>
          </div>
          <div>
            <dt className="text-white/50">Department</dt>
            <dd className="mt-1 font-medium">{departmentName}</dd>
          </div>
          <div>
            <dt className="text-white/50">Status</dt>
            <dd className="mt-1 font-medium capitalize">{values.status}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function NewsReviewStep({
  campusName,
  departmentName,
  labels,
  locale,
  onPublish,
  onSaveDraft,
  pendingStatus,
  values,
}: ReviewStepProps) {
  const activeTitle = locale === "no" ? values.title_no : values.title_en;
  const activeDescription =
    locale === "no" ? values.description_no : values.description_en;
  const otherLocale = locale === "no" ? "EN" : "NO";
  const otherTitle = locale === "no" ? values.title_en : values.title_no;
  const otherDescription =
    locale === "no" ? values.description_en : values.description_no;
  const otherLocaleEmpty = !(
    otherTitle.trim() || (otherDescription ?? "").trim()
  );
  const checklist = [
    { complete: Boolean(activeTitle.trim()), label: "Headline" },
    { complete: Boolean(values.slug.trim()), label: "Slug" },
    { complete: Boolean(values.campus_id), label: "Campus" },
    { complete: Boolean(values.image), label: "Cover image" },
    {
      complete: Boolean((activeDescription ?? "").trim()),
      label: "Article body",
    },
  ];

  return (
    <div className="space-y-7">
      <div>
        <p className="font-medium text-[#3DA9E0] text-[11px] uppercase tracking-[0.14em]">
          Review
        </p>
        <h2 className="mt-2 font-light text-3xl tracking-tight">
          Ready for readers?
        </h2>
        <p className="mt-2 text-slate-600 text-sm">
          Reviewing {locale.toUpperCase()} for {departmentName} · {campusName}.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/75">
        {checklist.map((item) => (
          <div
            className="flex items-center gap-3 border-slate-200 border-t px-4 py-3 first:border-t-0"
            key={item.label}
          >
            {item.complete ? (
              <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-white">
                <Check size={13} />
              </span>
            ) : (
              <Circle className="text-slate-300" size={24} />
            )}
            <span className="font-medium text-sm">{item.label}</span>
            <span className="ml-auto text-slate-500 text-xs">
              {item.complete ? "Ready" : "Missing"}
            </span>
          </div>
        ))}
      </div>

      <div
        className={`rounded-xl border p-4 ${
          otherLocaleEmpty
            ? "border-amber-300 bg-amber-50"
            : "border-emerald-200 bg-emerald-50"
        }`}
      >
        <p className="font-medium text-sm">
          {locale.toUpperCase()} summary:{" "}
          {activeTitle || "Headline still needed"}
        </p>
        <p className="mt-1 text-slate-600 text-sm">
          {otherLocaleEmpty
            ? `${otherLocale} is empty. You can save or publish with one localized version.`
            : `${otherLocale} also has localized content.`}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 font-medium text-[#001731] text-sm disabled:opacity-60"
          disabled={pendingStatus !== null}
          onClick={onSaveDraft}
          type="button"
        >
          <Save size={15} />
          {pendingStatus === "draft" ? "Saving..." : labels.saveDraft}
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-[#001731] px-4 py-2.5 font-medium text-sm text-white disabled:opacity-60"
          disabled={pendingStatus !== null}
          onClick={onPublish}
          type="button"
        >
          <Send size={15} />
          {pendingStatus === "published" ? "Publishing..." : labels.publish}
        </button>
      </div>
    </div>
  );
}

function NewsMobilePreview({
  campusName,
  departmentName,
  locale,
  onToggle,
  open,
  values,
}: {
  campusName: string;
  departmentName: string;
  locale: NewsLocale;
  onToggle: () => void;
  open: boolean;
  values: NewsFormValues;
}) {
  return (
    <section className="mb-7 overflow-hidden rounded-xl border border-slate-200 bg-[#e8f2f7] lg:hidden">
      <button
        aria-controls="news-mobile-preview"
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={onToggle}
        type="button"
      >
        <span className="font-medium text-[#15803d] text-sm">Live preview</span>
        <span className="text-slate-500 text-xs">
          {open ? "Hide preview" : "Show preview"}
        </span>
      </button>
      {open && (
        <div className="border-slate-200 border-t p-4" id="news-mobile-preview">
          <NewsStudioPreview
            campusName={campusName}
            departmentName={departmentName}
            locale={locale}
            values={values}
          />
        </div>
      )}
    </section>
  );
}

export function NewsStudioEditor({
  allowedDepartmentIds,
  article,
  campuses,
  canChangeCampus = true,
  defaultCampusId,
  initialDepartments,
  isNew,
  labels,
}: NewsStudioEditorProps) {
  const router = useRouter();
  const departmentRequestSequence = useRef(0);
  const [step, setStep] = useState(0);
  const [locale, setLocale] = useState<NewsLocale>("no");
  const [values, setValues] = useState(() =>
    createNewsStudioDefaults(article, campuses, defaultCampusId)
  );
  const [departments, setDepartments] = useState(initialDepartments);
  const [dirty, setDirty] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<
    NewsFormValues["status"] | null
  >(null);

  const availableDepartments = useMemo(
    () =>
      allowedDepartmentIds
        ? departments.filter((department) =>
            allowedDepartmentIds.includes(department.$id)
          )
        : departments,
    [allowedDepartmentIds, departments]
  );
  const campusName =
    campuses.find((campus) => campus.$id === values.campus_id)?.name ??
    "Campus";
  const departmentName =
    availableDepartments.find(
      (department) => department.$id === values.department_id
    )?.Name ?? "All departments";
  const completedSteps = getNewsStepCompletion(values, locale);

  const setValue = <Key extends keyof NewsFormValues>(
    key: Key,
    value: NewsFormValues[Key]
  ): void => {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };

  const handleCampusChange = async (campusId: string): Promise<void> => {
    setValue("campus_id", campusId);
    setValue("department_id", null);
    await refreshNewsDepartments({
      campusId,
      loadDepartments: listDepartmentsForCampus,
      requestSequence: departmentRequestSequence,
      setDepartments,
    });
  };

  const submit = async (status: NewsFormValues["status"]): Promise<void> => {
    const payload = getNewsSavedValues(values, status);
    const validated = newsSchema.safeParse(payload);
    if (!validated.success) {
      toast.error(labels.saveError);
      return;
    }

    setPendingStatus(status);
    try {
      const result = isNew
        ? await createNews(validated.data)
        : await updateNews(article!.$id, validated.data);
      if (result.error) {
        toast.error(
          typeof result.error === "string" ? result.error : labels.saveError
        );
        return;
      }
      setValues(getNewsSavedValues(validated.data, status));
      setDirty(false);
      toast.success(
        status === "published" ? labels.publishSuccess : labels.saveSuccess
      );
      if (isNew) {
        router.push(`/news/${result.data}`);
        return;
      }
      router.refresh();
    } finally {
      setPendingStatus(null);
    }
  };

  return (
    <div className="-m-8 min-h-screen overflow-hidden bg-[#faf7f2] text-[#07111f] md:-m-12">
      <div className="flex min-h-screen flex-col">
        <NewsStudioHeader
          articleTitle={values.title_no || values.title_en}
          isNew={isNew}
          labels={labels}
          onDiscard={() => router.push("/news")}
          onPublish={() => submit("published")}
          onSaveDraft={() => submit("draft")}
          pendingStatus={pendingStatus}
        />
        <NewsStudioStepRail
          completedSteps={completedSteps}
          dirty={dirty}
          locale={locale}
          onLocaleChange={setLocale}
          onStepChange={setStep}
          step={step}
        />
        <main className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]">
          <section className="min-h-0 overflow-y-auto px-4 py-8 md:px-8">
            <div className="mx-auto max-w-3xl">
              <div className="mb-7 flex items-center gap-3 text-slate-500 text-xs">
                <span className="font-medium uppercase tracking-[0.12em]">
                  {departmentName} · {campusName}
                </span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>
                  Step {step + 1} of {NEWS_STEPS.length} · {NEWS_STEPS[step]}
                </span>
              </div>
              <NewsMobilePreview
                campusName={campusName}
                departmentName={departmentName}
                locale={locale}
                onToggle={() => setMobilePreviewOpen((current) => !current)}
                open={mobilePreviewOpen}
                values={values}
              />
              {step === 0 && (
                <NewsEssentialsStep
                  campuses={campuses}
                  canChangeCampus={canChangeCampus}
                  departments={availableDepartments}
                  locale={locale}
                  onCampusChange={handleCampusChange}
                  setValue={setValue}
                  values={values}
                />
              )}
              {step === 1 && (
                <NewsArticleStep
                  locale={locale}
                  setValue={setValue}
                  values={values}
                />
              )}
              {step === 2 && (
                <NewsMediaVisibilityStep
                  campusName={campusName}
                  departmentName={departmentName}
                  locale={locale}
                  setValue={setValue}
                  values={values}
                />
              )}
              {step === 3 && (
                <NewsReviewStep
                  campusName={campusName}
                  departmentName={departmentName}
                  labels={labels}
                  locale={locale}
                  onPublish={() => submit("published")}
                  onSaveDraft={() => submit("draft")}
                  pendingStatus={pendingStatus}
                  setValue={setValue}
                  values={values}
                />
              )}
            </div>
          </section>
          <aside className="hidden min-h-0 border-slate-200 border-l bg-[#e8f2f7] lg:flex lg:flex-col">
            <div className="flex items-center justify-between border-slate-200 border-b bg-white/35 px-4 py-3 text-xs">
              <span className="font-medium text-[#15803d]">Live preview</span>
              <span className="text-slate-500">{labels.preview}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
              <NewsStudioPreview
                campusName={campusName}
                departmentName={departmentName}
                locale={locale}
                values={values}
              />
            </div>
          </aside>
        </main>
        <NewsStudioFooter
          labels={labels}
          onBack={() => setStep((current) => Math.max(0, current - 1))}
          onContinue={() =>
            setStep((current) => Math.min(NEWS_STEPS.length - 1, current + 1))
          }
          onPublish={() => submit("published")}
          onSaveDraft={() => submit("draft")}
          pendingStatus={pendingStatus}
          step={step}
        />
      </div>
    </div>
  );
}

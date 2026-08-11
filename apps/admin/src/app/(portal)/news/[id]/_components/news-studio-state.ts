import type {
  Campus,
  ContentTranslations,
  News,
} from "@repo/api/types/appwrite";
import { hasRichContent } from "@/lib/plate-content";
import type { NewsFormValues } from "../../../_actions/schemas";

export type NewsLocale = "no" | "en";
export type NewsWithTranslations = News & {
  translation_refs: ContentTranslations[];
};

export interface NewsTranslationInput {
  description: string;
  locale: NewsLocale;
  title: string;
}

export type NewsTranslationDraft = Omit<NewsTranslationInput, "locale">;

interface RefreshNewsDepartmentsOptions<Department> {
  campusId: string;
  loadDepartments: (campusId: string) => Promise<Department[]>;
  requestSequence: { current: number };
  setDepartments: (departments: Department[]) => void;
}

export const refreshNewsDepartments = async <Department>(
  options: RefreshNewsDepartmentsOptions<Department>
): Promise<void> => {
  const requestId = options.requestSequence.current + 1;
  options.requestSequence.current = requestId;
  options.setDepartments([]);

  if (!options.campusId) {
    return;
  }

  try {
    const departments = await options.loadDepartments(options.campusId);
    if (options.requestSequence.current === requestId) {
      options.setDepartments(departments);
    }
  } catch {
    // The current request already cleared stale options before loading.
  }
};

export const getNewsArticleEditorState = (
  values: NewsFormValues,
  locale: NewsLocale
): { editorKey: NewsLocale; value: string } => {
  const value = locale === "no" ? values.description_no : values.description_en;
  return {
    editorKey: locale,
    value: value ?? "",
  };
};

export const formatNewsPreviewDate = (
  timestamp: string,
  locale: NewsLocale
): string =>
  new Intl.DateTimeFormat(locale === "no" ? "nb-NO" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Oslo",
    year: "numeric",
  }).format(new Date(timestamp));

export const getNewsStepCompletion = (
  values: NewsFormValues,
  locale: NewsLocale
): [boolean, boolean, boolean, boolean] => {
  const hasEssentialFields = Boolean(
    (values.title_no.trim() || values.title_en.trim()) &&
      values.slug.trim() &&
      values.campus_id
  );
  const description =
    locale === "no" ? values.description_no : values.description_en;
  const hasArticleBody = hasRichContent(description);
  const hasCoverImage = Boolean(values.image);

  return [
    hasEssentialFields,
    hasArticleBody,
    hasCoverImage,
    hasEssentialFields && hasArticleBody && hasCoverImage,
  ];
};

const parseCategory = (
  translation: ContentTranslations | undefined
): string | null => {
  if (!translation?.additional_fields) {
    return null;
  }

  try {
    const fields = JSON.parse(translation.additional_fields) as {
      category?: unknown;
    };
    return typeof fields.category === "string" ? fields.category : null;
  } catch {
    return null;
  }
};

export const createNewsStudioDefaults = (
  article: NewsWithTranslations | null,
  campuses: Campus[],
  defaultCampusId?: string
): NewsFormValues => {
  const norwegian = article?.translation_refs.find(
    (translation) => translation.locale === "no"
  );
  const english = article?.translation_refs.find(
    (translation) => translation.locale === "en"
  );

  return {
    author: article?.author ?? null,
    campus_id: article?.campus_id ?? defaultCampusId ?? campuses[0]?.$id ?? "",
    category: parseCategory(norwegian) ?? parseCategory(english),
    department_id: article?.department_id ?? null,
    description_en: english?.description ?? "",
    description_no: norwegian?.description ?? "",
    image: article?.image ?? "",
    slug: article?.slug ?? "",
    status: article?.status === "published" ? "published" : "draft",
    sticky: article?.sticky ?? false,
    title_en: english?.title ?? "",
    title_no: norwegian?.title ?? "",
  };
};

export const getNewsSavedValues = (
  values: NewsFormValues,
  status: NewsFormValues["status"]
): NewsFormValues => ({ ...values, status });

export const getNewsEditorInteractionProps = (
  isNew: boolean,
  pendingStatus: NewsFormValues["status"] | null
): { "aria-busy": boolean; inert: boolean } => {
  const locked = isNew && pendingStatus !== null;
  return {
    "aria-busy": locked,
    inert: locked,
  };
};

interface ReconcileNewsSavedStateOptions {
  currentValues: NewsFormValues;
  hasConcurrentEdits: boolean;
  status: NewsFormValues["status"];
  submittedValues: NewsFormValues;
}

export const reconcileNewsSavedState = (
  options: ReconcileNewsSavedStateOptions
): { dirty: boolean; values: NewsFormValues } => {
  const values = options.hasConcurrentEdits
    ? options.currentValues
    : options.submittedValues;

  return {
    dirty: options.hasConcurrentEdits,
    values: getNewsSavedValues(values, options.status),
  };
};

export const getNewsTranslationDraftSource = (
  values: NewsFormValues,
  sourceLocale: NewsLocale
): NewsTranslationDraft =>
  sourceLocale === "no"
    ? {
        description: values.description_no ?? "",
        title: values.title_no,
      }
    : {
        description: values.description_en ?? "",
        title: values.title_en,
      };

export const applyNewsTranslationDraft = (
  values: NewsFormValues,
  sourceLocale: NewsLocale,
  draft: NewsTranslationDraft
): NewsFormValues =>
  sourceLocale === "no"
    ? {
        ...values,
        description_en: draft.description,
        title_en: draft.title,
      }
    : {
        ...values,
        description_no: draft.description,
        title_no: draft.title,
      };

export const getNewsTranslationInputs = (
  values: NewsFormValues
): NewsTranslationInput[] => {
  const translations: NewsTranslationInput[] = [
    {
      description: values.description_no?.trim() ?? "",
      locale: "no",
      title: values.title_no.trim(),
    },
    {
      description: values.description_en?.trim() ?? "",
      locale: "en",
      title: values.title_en.trim(),
    },
  ];

  return translations.filter(
    (translation) =>
      translation.title || hasRichContent(translation.description)
  );
};

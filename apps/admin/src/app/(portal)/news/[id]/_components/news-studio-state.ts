import type {
  Campus,
  ContentTranslations,
  News,
} from "@repo/api/types/appwrite";
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
  const primary = norwegian ?? english;

  return {
    author: article?.author ?? null,
    campus_id: article?.campus_id ?? defaultCampusId ?? campuses[0]?.$id ?? "",
    category: parseCategory(primary),
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
    (translation) => translation.title || translation.description
  );
};

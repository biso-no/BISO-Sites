import { Locale, PageStatus, PageVisibility } from "@repo/api/types/appwrite";
import type { Data } from "@repo/editor";
import { UnifiedEditorClient } from "../_components/unified-editor-client";

const SUPPORTED_LOCALES: Locale[] = [Locale.NO, Locale.EN];

const EMPTY_DATA: Data = {
  root: { props: {} },
  content: [],
};

type SearchParams = Promise<{
  title?: string;
  slug?: string;
  locale?: string;
  description?: string;
}>;

export default async function NewPageEditor({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  
  // Get initial values from query params (set by AI assistant)
  const initialTitle = params.title || "";
  const initialSlug = params.slug || "";
  const initialDescription = params.description || "";
  const initialLocale = (params.locale === "en" ? Locale.EN : Locale.NO) as Locale;

  const initialLocaleData: Record<Locale, { title: string; description: string; data: Data } | null> = {
    [Locale.NO]: {
      title: initialLocale === Locale.NO ? initialTitle : "",
      description: initialLocale === Locale.NO ? initialDescription : "",
      data: EMPTY_DATA,
    },
    [Locale.EN]: {
      title: initialLocale === Locale.EN ? initialTitle : "",
      description: initialLocale === Locale.EN ? initialDescription : "",
      data: EMPTY_DATA,
    },
  };

  return (
    <UnifiedEditorClient
      availableLocales={SUPPORTED_LOCALES}
      currentLocale={initialLocale}
      initialLocaleData={initialLocaleData}
      initialSlug={initialSlug}
      status={PageStatus.DRAFT}
      visibility={PageVisibility.PUBLIC}
    />
  );
}

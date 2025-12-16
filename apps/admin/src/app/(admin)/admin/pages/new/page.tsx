import { Locale, PageStatus, PageVisibility } from "@repo/api/types/appwrite";
import type { Data } from "@repo/editor";
import { UnifiedEditorClient } from "../_components/unified-editor-client";

const SUPPORTED_LOCALES: Locale[] = [Locale.NO, Locale.EN];

const EMPTY_DATA: Data = {
  root: { props: {} },
  content: [],
};

export default async function NewPageEditor() {
  const initialLocaleData: Record<Locale, { title: string; description: string; data: Data } | null> = {
    [Locale.NO]: {
      title: "",
      description: "",
      data: EMPTY_DATA,
    },
    [Locale.EN]: {
      title: "",
      description: "",
      data: EMPTY_DATA,
    },
  };

  return (
    <UnifiedEditorClient
      availableLocales={SUPPORTED_LOCALES}
      currentLocale={Locale.NO}
      initialLocaleData={initialLocaleData}
      initialSlug=""
      status={PageStatus.DRAFT}
      visibility={PageVisibility.PUBLIC}
    />
  );
}

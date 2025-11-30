import type {
  Locale,
  PageStatus,
  PageVisibility,
} from "@repo/api/types/appwrite";
import type { PageBuilderDocument } from "@repo/editor";

export type ManagedPageTranslationInput = {
  locale: Locale;
  title?: string;
  description?: string | null;
  draftDocument?: PageBuilderDocument | null;
  publish?: boolean;
};

export type CreateManagedPageInput = {
  slug: string;
  title: string;
  status?: PageStatus;
  visibility?: PageVisibility;
  template?: string | null;
  campusId?: string | null;
  translations: ManagedPageTranslationInput[];
};

export type UpdateManagedPageInput = {
  pageId: string;
  slug?: string;
  title?: string;
  status?: PageStatus;
  visibility?: PageVisibility;
  template?: string | null;
  campusId?: string | null;
};

export type SavePageDraftInput = {
  translationId: string;
  title?: string;
  slug?: string | null;
  description?: string | null;
  draftDocument?: PageBuilderDocument | null;
};

export type PublishPageInput = {
  translationId: string;
  document?: PageBuilderDocument | null;
  title?: string;
  slug?: string | null;
  description?: string | null;
  pageStatus?: PageStatus;
};

export type EnsureTranslationInput = {
  pageId: string;
  locale: Locale;
  title?: string;
  description?: string | null;
  sourceTranslationId?: string;
};

export type SaveTranslatedPageInput = {
  pageId: string;
  targetLocale: Locale;
  translatedData: PageBuilderDocument;
  translatedTitle: string;
  translatedSlug: string;
  translatedDescription?: string | null;
  sourceTranslationId: string;
};

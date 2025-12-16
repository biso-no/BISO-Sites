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


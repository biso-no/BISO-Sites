import type {
  Locale,
  PageStatus,
  PageVisibility,
} from "@repo/api/types/appwrite";
import type { PageBuilderDocument } from "@repo/editor";

export interface ManagedPageTranslationInput {
  description?: string | null;
  draftDocument?: PageBuilderDocument | null;
  locale: Locale;
  publish?: boolean;
  title?: string;
}

export interface CreateManagedPageInput {
  campusId?: string | null;
  departmentId?: string | null;
  slug: string;
  status?: PageStatus;
  template?: string | null;
  title: string;
  translations: ManagedPageTranslationInput[];
  visibility?: PageVisibility;
}

export interface UpdateManagedPageInput {
  campusId?: string | null;
  departmentId?: string | null;
  pageId: string;
  slug?: string;
  status?: PageStatus;
  template?: string | null;
  title?: string;
  visibility?: PageVisibility;
}

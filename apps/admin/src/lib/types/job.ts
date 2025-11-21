import type { ContentTranslations, Jobs } from "@repo/api/types/appwrite";
import type { TranslationMap } from "@/lib/utils/content-translations";

export interface JobMetadata extends Record<string, unknown> {
  type?: string;
  application_deadline?: string;
  start_date?: string;
  contact_name?: string;
  contact_email?: string;
  apply_url?: string;
  image?: string;
  short_description?: string;
  [key: string]: unknown;
}

export interface AdminJob extends Jobs {
  translation_refs: ContentTranslations[];
  translations: TranslationMap<ContentTranslations>;
  metadata_parsed: JobMetadata;
}

import type { ContentTranslations, Jobs } from "@repo/api/types/appwrite";
import type { TranslationMap } from "@/lib/utils/content-translations";

export interface JobMetadata extends Record<string, unknown> {
  application_deadline?: string;
  apply_url?: string;
  contact_email?: string;
  contact_name?: string;
  image?: string;
  short_description?: string;
  start_date?: string;
  type?: string;
  [key: string]: unknown;
}

export interface AdminJob extends Omit<Jobs, "translations"> {
  metadata_parsed: JobMetadata;
  translations: ContentTranslations[];
  translations_map: TranslationMap<ContentTranslations>;
}

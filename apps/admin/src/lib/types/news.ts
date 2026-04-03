import type { Models } from "@repo/api";
import type { ContentTranslations } from "@repo/api/types/appwrite";
import type { TranslationMap } from "@/lib/utils/content-translations";

export interface NewsItem extends Models.Row {
  // Relationship references (populated at runtime)
  campus?: { $id: string; name: string };
  campus_id: string;
  department?: { $id: string; Name: string; campus_id: string };
  department_id: string;
  image?: string;
  locale?: "en" | "no"; // Keep for backwards compatibility
  slug?: string;
  status: string;
  sticky?: boolean;
  translation_refs?: ContentTranslations[];
  translations?: TranslationMap<ContentTranslations>;
  url?: string;
}

// Helper interface for working with news data including translations
export interface NewsItemWithTranslations extends NewsItem {
  content?: string;
  // Convenience properties for the current locale
  title?: string;
}

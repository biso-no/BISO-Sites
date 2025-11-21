import type { Models } from "@repo/api";
import type { ContentTranslation } from "./content-translation";

export interface NewsItem extends Models.Row {
  status: string;
  campus_id: string;
  department_id: string;
  slug?: string;
  url?: string;
  image?: string;
  sticky?: boolean;
  locale?: "en" | "no"; // Keep for backwards compatibility
  // Relationship references (populated at runtime)
  campus?: { $id: string; name: string };
  department?: { $id: string; Name: string; campus_id: string };
  translation_refs?: ContentTranslation[];
}

// Helper interface for working with news data including translations
interface NewsItemWithTranslations extends NewsItem {
  // Convenience properties for the current locale
  title?: string;
  content?: string;
}

import type { Models } from "@repo/api";

export interface ContentTranslation extends Models.Row {
  content_type: "job" | "event" | "news" | "product";
  content_id: string;
  locale: "en" | "no";
  title: string;
  description: string;
  short_description?: string | null;
  additional_fields?: string | null; // JSON string for flexible content
}

type TranslatableContent = {
  title: string;
  description: string;
  [key: string]: any; // For additional translatable fields
};

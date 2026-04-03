import type { Models } from "@repo/api";

export interface ContentTranslation extends Models.Row {
  additional_fields?: string | null; // JSON string for flexible content
  content_id: string;
  content_type: "job" | "event" | "news" | "product";
  description: string;
  locale: "en" | "no";
  short_description?: string | null;
  title: string;
}

type TranslatableContent = {
  title: string;
  description: string;
  [key: string]: any; // For additional translatable fields
};

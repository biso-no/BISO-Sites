import type { Models } from "@repo/api";

export interface ContentTranslation extends Models.Row {
  additional_fields?: string | null; // JSON string for flexible content
  content_id: string;
  content_type: "job" | "event" | "news" | "product" | "site_page";
  description: string;
  locale: "en" | "no";
  short_description?: string | null;
  title: string;
}

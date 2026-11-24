import type { Settings } from "meilisearch";

export const SEARCH_INDEX_DEFAULT = "site_content";

export function searchIndexName(
  env: Record<string, string | undefined> = process.env
): string {
  return env.MEILISEARCH_INDEX || SEARCH_INDEX_DEFAULT;
}

/** Applied by the reindex; typed so a misspelled setting fails to compile. */
export const SEARCH_INDEX_SETTINGS: Settings = {
  searchableAttributes: [
    "title",
    "keywords",
    "summary",
    "body",
    "department",
    "location",
    "category",
  ],
  filterableAttributes: [
    "type",
    "locale",
    "campus_id",
    "row_id",
    "visible_until",
    "synced_at",
  ],
  pagination: { maxTotalHits: 1000 },
};

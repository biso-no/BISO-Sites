import { Query } from "@repo/api";
import type { ContentTranslations } from "@repo/api/types/appwrite";
import { SEARCH_CANDIDATE_CAP } from "@/lib/list-params";
import type { Db } from "./queries";

export type SearchableContentType = "event" | "job" | "product";

export interface ContentSearchResult {
  /** True when the cap was filled, so callers must not claim an exact total. */
  capped: boolean;
  ids: string[];
}

const EMPTY: ContentSearchResult = { ids: [], capped: false };

/**
 * Phase 1 of the two-phase search: resolve a query to parent row ids.
 *
 * Appwrite fulltext cannot traverse a relationship — `Query.search` on
 * `translation_refs.title` is rejected outright — and `jobs.translations` is
 * `twoWay: false`, so jobs cannot be filtered from the translations side
 * either. Searching `content_translations` directly is the one shape that
 * works for all three surfaces, so all three use it.
 *
 * Callers pass the returned ids to `Query.equal("$id", ids)` on the parent
 * table alongside their own filters, which keeps `total` correct.
 */
export async function findContentIdsBySearch(
  db: Db,
  contentType: SearchableContentType,
  search: string,
  locale?: string
): Promise<ContentSearchResult> {
  const term = search.trim();
  if (!term) {
    return EMPTY;
  }

  const queries = [
    Query.or([Query.search("title", term), Query.search("description", term)]),
    Query.equal("content_type", contentType),
    Query.select(["content_id"]),
    Query.limit(SEARCH_CANDIDATE_CAP),
  ];

  if (locale) {
    queries.push(Query.equal("locale", locale));
  }

  try {
    const response = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      queries
    );

    const ids: string[] = [];
    const seen = new Set<string>();
    for (const row of response.rows) {
      const id = row.content_id;
      // One content row has a translation per locale, so the same parent id
      // arrives twice whenever the search is not locale-scoped.
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }

    return { ids, capped: response.rows.length >= SEARCH_CANDIDATE_CAP };
  } catch (error) {
    // Logged, never swallowed: `queryEvents` returning [] on a rejected
    // Query.search is exactly how the events search stayed broken in prod.
    console.error(
      `Content search failed (type=${contentType}, term=${term}):`,
      error
    );
    return EMPTY;
  }
}

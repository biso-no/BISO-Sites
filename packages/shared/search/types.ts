export type SearchType =
  | "event"
  | "news"
  | "job"
  | "product"
  | "page"
  | "unit"
  | "document"
  | "coded";

export type SearchLocale = "no" | "en";

export const SEARCH_LOCALES: readonly SearchLocale[] = ["no", "en"];

/** Campus bucket for content that belongs to every campus. */
export const ALL_CAMPUSES = "all";

/** visible_until value (year 3000, Unix seconds) for entries with no end. */
export const OPEN_ENDED = 32_503_680_000;

const CAMPUS_IDS = new Set(["1", "2", "3", "4"]);
const SAFE_ID_CHAR = /[A-Za-z0-9_]/;

export interface SearchEntry {
  body: string;
  /** "1".."4" or ALL_CAMPUSES. */
  campus_id: string;
  category: string | null;
  cover_pattern: string | null;
  deadline: number | null;
  /** Display name (unitDisplayName). */
  department: string | null;
  ends_at: number | null;
  id: string;
  image: string | null;
  in_stock: boolean | null;
  keywords: string[];
  locale: SearchLocale;
  location: string | null;
  member_only: boolean;
  member_price: number | null;
  price: number | null;
  published_at: number | null;
  row_id: string;
  /** Unix seconds. */
  starts_at: number | null;
  summary: string;
  /** Unix ms of the write (reindex sweep). */
  synced_at: number;
  text_locale: SearchLocale;
  title: string;
  type: SearchType;
  /** Path, starts with "/". */
  url: string;
  /** Unix seconds, OPEN_ENDED when none. */
  visible_until: number;
}

/**
 * A string as Meilisearch id characters. "-" is the escape character: every
 * character outside [A-Za-z0-9_] (including "-" itself) is encoded as
 * `-<hex>-`, so distinct inputs never give the same output.
 */
export function escapeIdPart(value: string): string {
  let encoded = "";
  for (const char of value) {
    if (SAFE_ID_CHAR.test(char)) {
      encoded += char;
    } else {
      encoded += `-${(char.codePointAt(0) ?? 0).toString(16)}-`;
    }
  }
  return encoded;
}

/** Deterministic Meilisearch document id; distinct row ids never collide. */
export function searchEntryId(
  type: SearchType,
  rowId: string,
  locale: SearchLocale
): string {
  return `${type}_${escapeIdPart(rowId)}_${locale}`;
}

export function campusBucket(campusId: string | null | undefined): string {
  return campusId && CAMPUS_IDS.has(campusId) ? campusId : ALL_CAMPUSES;
}

export function toUnixSeconds(iso: string | null | undefined): number | null {
  if (!iso) {
    return null;
  }
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

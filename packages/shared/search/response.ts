import type { SearchLocale, SearchType } from "./types";

export const SEARCH_GROUPS = [
  "event",
  "news",
  "job",
  "product",
  "page",
  "unit",
] as const;

export type SearchGroup = (typeof SEARCH_GROUPS)[number];

const PAGE_GROUP_TYPES: readonly SearchType[] = ["page", "document", "coded"];

/** page, document and coded entries all show under the "page" group. */
export function groupOf(type: SearchType): SearchGroup {
  return PAGE_GROUP_TYPES.includes(type) ? "page" : (type as SearchGroup);
}

export function typesOf(group: SearchGroup): SearchType[] {
  return group === "page" ? [...PAGE_GROUP_TYPES] : [group];
}

export interface Segment {
  match: boolean;
  text: string;
}

export interface SearchHit {
  campus_id: string;
  /** campusIdToLabel(campus_id); "all" is localised by the request locale. */
  campus_name: string;
  category: string | null;
  cover_pattern: string | null;
  deadline: number | null;
  department: string | null;
  ends_at: number | null;
  group: SearchGroup;
  id: string;
  image: string | null;
  in_stock: boolean | null;
  location: string | null;
  member_only: boolean;
  member_price: number | null;
  price: number | null;
  published_at: number | null;
  snippet: Segment[];
  starts_at: number | null;
  text_locale: SearchLocale;
  title: Segment[];
  type: SearchType;
  url: string;
}

export type GroupCounts = Record<SearchGroup, number>;

export interface QuickSearchResponse {
  best: SearchHit | null;
  counts: GroupCounts;
  groups: Record<SearchGroup, SearchHit[]>;
  locale: SearchLocale;
  mode: "quick";
  query: string;
  total: number;
}

export interface PageSearchResponse {
  counts: GroupCounts;
  group: SearchGroup | null;
  hits: SearchHit[];
  locale: SearchLocale;
  mode: "page";
  page: number;
  pageSize: number;
  query: string;
  total: number;
  totalPages: number;
}

export type SearchResponse = QuickSearchResponse | PageSearchResponse;

export function emptyCounts(): GroupCounts {
  return { event: 0, news: 0, job: 0, product: 0, page: 0, unit: 0 };
}

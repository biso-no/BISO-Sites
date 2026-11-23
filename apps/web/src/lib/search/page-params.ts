import { parseSearchParams } from "@repo/shared/search/params";
import { SEARCH_GROUPS, type SearchGroup } from "@repo/shared/search/response";

export interface SearchPageParams {
  group: SearchGroup | null;
  onlyCampus: boolean;
  page: number;
  q: string;
}

type RawParams = Record<string, string | string[] | undefined>;

const firstOf = (raw: string | string[] | undefined): string | null =>
  (Array.isArray(raw) ? raw[0] : raw) ?? null;

/** Never throws: the same rules the API applies, so page and API agree. */
export function parseSearchPageParams(sp: RawParams): SearchPageParams {
  const input = new URLSearchParams();
  for (const [from, to] of [
    ["q", "q"],
    ["type", "type"],
    ["page", "page"],
    ["only", "only_campus"],
  ] as const) {
    const value = firstOf(sp[from]);
    if (value !== null) {
      input.set(to, value);
    }
  }
  const { q, group, page, onlyCampus } = parseSearchParams(input);
  return { q, group, page, onlyCampus };
}

/** Canonical order: q, type, only, page (page omitted when 1). */
export function searchPageHref(
  params: Partial<SearchPageParams> & { q: string }
): string {
  const next = new URLSearchParams();
  next.set("q", params.q);
  if (params.group && SEARCH_GROUPS.includes(params.group)) {
    next.set("type", params.group);
  }
  if (params.onlyCampus) {
    next.set("only", "1");
  }
  if (params.page && params.page > 1) {
    next.set("page", String(params.page));
  }
  return `/search?${next.toString()}`;
}

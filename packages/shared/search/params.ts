import { SEARCH_GROUPS, type SearchGroup } from "./response";
import type { SearchLocale } from "./types";

export const SEARCH_QUERY_MAX = 100;
export const SEARCH_PAGE_SIZE = 20;
export const QUICK_GROUP_SIZE = 2;
const SEARCH_PAGE_MAX = 50;

const WHITESPACE = /\s+/g;
const DIGITS = /^\d+$/;
const STUDY_CAMPUSES = new Set(["1", "2", "3", "4"]);

export interface SearchRequest {
  campus: string | null;
  group: SearchGroup | null;
  locale: SearchLocale;
  mode: "quick" | "page";
  onlyCampus: boolean;
  page: number;
  q: string;
}

function parsePage(raw: string | null): number {
  const value = raw?.trim() ?? "";
  if (!DIGITS.test(value)) {
    return 1;
  }
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) {
    return 1;
  }
  return Math.min(n, SEARCH_PAGE_MAX);
}

function parseGroup(raw: string | null): SearchGroup | null {
  return SEARCH_GROUPS.find((g) => g === raw) ?? null;
}

/** Never throws: malformed parameters fall back to defaults. */
export function parseSearchParams(params: URLSearchParams): SearchRequest {
  const q = (params.get("q") ?? "")
    .replace(WHITESPACE, " ")
    .trim()
    .slice(0, SEARCH_QUERY_MAX)
    .trim();
  const campusRaw = params.get("campus");
  const onlyRaw = params.get("only_campus");
  return {
    q,
    locale: params.get("locale") === "en" ? "en" : "no",
    campus: campusRaw && STUDY_CAMPUSES.has(campusRaw) ? campusRaw : null,
    onlyCampus: onlyRaw === "1" || onlyRaw === "true",
    group: parseGroup(params.get("type")),
    page: parsePage(params.get("page")),
    mode: params.get("mode") === "page" ? "page" : "quick",
  };
}

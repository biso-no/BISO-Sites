import {
  firstParam,
  type ListSearchParams,
  lastPageByOffset,
} from "@repo/shared/utils/list-params";

/**
 * Rows per page on the public list surfaces.
 *
 * 12 divides both the 2-column jobs grid and the 3-column events/shop grids
 * evenly, so a full page never leaves a ragged final row.
 */
export const WEB_PAGE_SIZE = 12;

/**
 * Ceiling on phase-1 search candidates.
 *
 * Search runs two-phase because Appwrite fulltext cannot traverse a
 * relationship: `content_translations` yields candidate ids, then the parent
 * table is filtered by them. A deliberately broad probe returned 186 hits, so
 * this is headroom rather than a limit anyone should reach — but when it IS
 * reached the result is marked `capped` rather than silently truncated.
 */
export const SEARCH_CANDIDATE_CAP = 500;

export interface WebPaginatedResult<T> {
  /** True when phase-1 search hit the cap, so `total` is a floor. */
  capped: boolean;
  page: number;
  rows: T[];
  size: number;
  /** Appwrite's count for the filtered set, never `rows.length`. */
  total: number;
}

export interface WebListParams {
  /** 1-based, always >= 1 and never past the offset ceiling. */
  page: number;
  /** Trimmed; "" when absent. */
  q: string;
}

/** Clamps rather than throws: junk in the address bar renders page 1. */
export function parseWebListParams(
  searchParams: ListSearchParams
): WebListParams {
  const rawPage = Number(firstParam(searchParams, "page"));
  const requested =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  // A page past the offset ceiling cannot be served, so carrying it forward
  // would have the surface report a page it never fetched.
  const page = Math.min(requested, lastPageByOffset(WEB_PAGE_SIZE));

  return { page, q: (firstParam(searchParams, "q") ?? "").trim() };
}

/** 1-based page to the 0-based offset Appwrite wants. */
export function webOffset(page: number): number {
  return (page - 1) * WEB_PAGE_SIZE;
}

/**
 * Short-circuit for actions that can prove the result is empty.
 *
 * `size` defaults to `WEB_PAGE_SIZE` but accepts an override so a caller using
 * a `pageSize` override (first-N consumers like `/students`) reports the size
 * it actually requested, not the generic default — `WebPaginatedResult.size`
 * should always describe what was asked for.
 */
export function emptyWebResult<T>(
  page: number,
  size: number = WEB_PAGE_SIZE
): WebPaginatedResult<T> {
  return { rows: [], total: 0, page, size, capped: false };
}

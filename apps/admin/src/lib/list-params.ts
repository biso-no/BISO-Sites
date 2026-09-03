/**
 * Pure, dependency-free list params. This module is imported by CLIENT
 * components (`PaginationBar`, `useListParams`), so it must NEVER import
 * `@repo/api` or anything that reaches `node-appwrite` — doing so drags the
 * server SDK (and `undici` -> `node:net`) into the browser bundle and breaks
 * every page that renders a pagination bar at dev runtime. The Appwrite
 * query builders live in `./list-queries` instead.
 */
export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 25;

/** Shape Next.js gives us from `await searchParams`. */
export type ListSearchParams = Record<string, string | string[] | undefined>;

export interface ListParams {
  /** 1-based, always >= 1. */
  page: number;
  /** Trimmed; "" when absent. */
  q: string;
  size: PageSize;
}

export interface PaginatedResult<T> {
  page: number;
  rows: T[];
  size: PageSize;
  /** Appwrite's true total for the filtered set, not the page length. */
  total: number;
}

/** Appwrite rejects an offset past this, so deeper pages cannot be served. */
export const MAX_OFFSET = 5000;

const firstValue = (
  value: string | string[] | undefined
): string | undefined => (Array.isArray(value) ? value[0] : value);

/** Reads a single non-pagination search param, taking the first of an array. */
export function firstParam(
  searchParams: ListSearchParams,
  key: string
): string | undefined {
  return firstValue(searchParams[key]);
}

const isPageSize = (value: number): value is PageSize =>
  (PAGE_SIZES as readonly number[]).includes(value);

/**
 * Clamps rather than throws: junk in the address bar renders page 1, never an
 * error page.
 */
export function parseListParams(
  searchParams: ListSearchParams,
  opts?: { pageKey?: string }
): ListParams {
  const rawPage = Number(firstValue(searchParams[opts?.pageKey ?? "page"]));
  const page =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const rawSize = Number(firstValue(searchParams.size));
  const size = isPageSize(rawSize) ? rawSize : DEFAULT_PAGE_SIZE;

  return { page, size, q: (firstValue(searchParams.q) ?? "").trim() };
}

/**
 * Last page reachable at all, given `total` rows and a page `size` — bounded
 * both by the actual result count and by `MAX_OFFSET`, since Appwrite rejects
 * an offset past that regardless of how many rows would otherwise remain.
 * `size` takes `number` (not `PageSize`) so `PaginationBar` can share this
 * with a legacy surface paging by a size outside `PAGE_SIZES` (e.g. 20).
 */
export function lastReachablePage(total: number, size: number): number {
  const byTotal = Math.max(1, Math.ceil(total / size));
  const byOffset = Math.floor(MAX_OFFSET / size) + 1;
  return Math.min(byTotal, byOffset);
}

/** Short-circuit for actions that can prove the result is empty. */
export function emptyResult<T>(params: ListParams): PaginatedResult<T> {
  return { rows: [], total: 0, page: params.page, size: params.size };
}

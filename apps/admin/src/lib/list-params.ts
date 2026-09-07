/**
 * Pure, dependency-free list params. This module is imported by CLIENT
 * components (`PaginationBar`, `useListParams`), so it must NEVER import
 * `@repo/api` or anything that reaches `node-appwrite` — doing so drags the
 * server SDK (and `undici` -> `node:net`) into the browser bundle and breaks
 * every page that renders a pagination bar at dev runtime. The Appwrite
 * query builders live in `./list-queries` instead.
 */
export {
  firstParam,
  type ListSearchParams,
  lastPageByOffset,
  lastReachablePage,
  MAX_OFFSET,
} from "@repo/shared/utils/list-params";

import {
  type ListSearchParams,
  lastPageByOffset,
} from "@repo/shared/utils/list-params";

export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 25;

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

const firstValue = (
  value: string | string[] | undefined
): string | undefined => (Array.isArray(value) ? value[0] : value);

const isPageSize = (value: number): value is PageSize =>
  (PAGE_SIZES as readonly number[]).includes(value);

/**
 * Clamps rather than throws: junk in the address bar renders page 1, never an
 * error page.
 */
export function parseListParams(
  searchParams: ListSearchParams,
  opts?: { pageKey?: string; qKey?: string; sizeKey?: string }
): ListParams {
  const rawSize = Number(firstValue(searchParams[opts?.sizeKey ?? "size"]));
  const size = isPageSize(rawSize) ? rawSize : DEFAULT_PAGE_SIZE;

  const rawPage = Number(firstValue(searchParams[opts?.pageKey ?? "page"]));
  const requestedPage =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  // A page past the offset ceiling cannot be served, so carrying it forward
  // would have every surface report a page it never fetched: `?page=999` gave
  // the same slice as the last reachable page while claiming to be page 999,
  // which left Previous repeating that slice hundreds of times.
  const page = Math.min(requestedPage, lastPageByOffset(size));

  const q = (firstValue(searchParams[opts?.qKey ?? "q"]) ?? "").trim();

  return { page, size, q };
}

/** Short-circuit for actions that can prove the result is empty. */
export function emptyResult<T>(params: ListParams): PaginatedResult<T> {
  return { rows: [], total: 0, page: params.page, size: params.size };
}

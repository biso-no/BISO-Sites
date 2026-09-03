import { Query } from "@repo/api";

export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 25;

/** Shape Next.js gives us from `await searchParams`. */
export type ListSearchParams = Record<string, string | string[] | undefined>;

export type ListParams = {
  /** 1-based, always >= 1. */
  page: number;
  size: PageSize;
  /** Trimmed; "" when absent. */
  q: string;
};

export type PaginatedResult<T> = {
  rows: T[];
  /** Appwrite's true total for the filtered set, not the page length. */
  total: number;
  page: number;
  size: PageSize;
};

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
  opts?: { pageKey?: string }
): ListParams {
  const rawPage = Number(firstValue(searchParams[opts?.pageKey ?? "page"]));
  const page =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const rawSize = Number(firstValue(searchParams.size));
  const size = isPageSize(rawSize) ? rawSize : DEFAULT_PAGE_SIZE;

  return { page, size, q: (firstValue(searchParams.q) ?? "").trim() };
}

export function paginationQueries(params: ListParams): string[] {
  return [
    Query.limit(params.size),
    Query.offset((params.page - 1) * params.size),
  ];
}

/** Short-circuit for actions that can prove the result is empty. */
export function emptyResult<T>(params: ListParams): PaginatedResult<T> {
  return { rows: [], total: 0, page: params.page, size: params.size };
}

/**
 * Pure, dependency-free list params.
 *
 * Imported by CLIENT components, so it must NEVER import `@repo/api` or
 * anything reaching `node-appwrite` — that drags the server SDK (and
 * `undici` -> `node:net`) into the browser bundle and breaks every page
 * rendering a pagination control at dev runtime.
 *
 * Size-dependent helpers (`PAGE_SIZES`, `parseListParams`) stay in
 * `apps/admin/src/lib/list-params.ts`: admin's `PageSize` union is 25|50|100,
 * which web's fixed size of 12 cannot satisfy.
 */

/** Appwrite rejects an offset past this, so deeper pages cannot be served. */
export const MAX_OFFSET = 5000;

/** Shape Next.js gives us from `await searchParams`. */
export type ListSearchParams = Record<string, string | string[] | undefined>;

/** Reads a single search param, taking the first of a repeated key. */
export function firstParam(
  searchParams: ListSearchParams,
  key: string
): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Last page the offset ceiling allows, independent of how many rows exist.
 *
 * Knowable without a count, which is what lets a parser clamp a hand-typed
 * page before anything is fetched.
 */
export function lastPageByOffset(size: number): number {
  return Math.floor(MAX_OFFSET / size) + 1;
}

/**
 * Last page reachable at all — bounded both by the row count and by
 * `MAX_OFFSET`, since Appwrite rejects an offset past that regardless of how
 * many rows would otherwise remain. Takes `number` rather than a size union so
 * both apps can share it.
 */
export function lastReachablePage(total: number, size: number): number {
  const byTotal = Math.max(1, Math.ceil(total / size));
  return Math.min(byTotal, lastPageByOffset(size));
}

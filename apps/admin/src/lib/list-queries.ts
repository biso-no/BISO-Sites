import { Query } from "@repo/api";
import { type ListParams, MAX_OFFSET } from "./list-params";

/**
 * Appwrite pagination queries for a list action.
 *
 * Server-only by construction: it imports `@repo/api`, so it must not be pulled
 * into a client component. Pure params helpers live in `./list-params`, which
 * stays dependency-free for exactly that reason.
 */
export function paginationQueries(params: ListParams): string[] {
  // This clamp is what guarantees Appwrite is never asked for an offset it
  // rejects, even from a stale bookmark or a hand-typed `?page=`.
  // `lastReachablePage` (used by `PaginationBar`) is the other half: it stops
  // an unreachable page from being offered as a link in the first place.
  const offset = Math.min((params.page - 1) * params.size, MAX_OFFSET);
  return [Query.limit(params.size), Query.offset(offset)];
}

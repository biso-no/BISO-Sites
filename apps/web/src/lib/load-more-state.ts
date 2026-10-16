import { MAX_OFFSET } from "@repo/shared/utils/list-params";
import { WEB_PAGE_SIZE } from "./list-params";

export interface LoadMoreState<T> {
  items: T[];
  /** The page a "Load more" would request next. 1-based. */
  nextPage: number;
  status: "error" | "idle" | "loading";
  /** Appwrite's total for the filtered set, refreshed on every page. */
  total: number;
}

export type LoadMoreAction<T> =
  | { rows: T[]; total: number; type: "loaded" }
  | { type: "failed" }
  | { type: "start" };

export function initialLoadMoreState<T>(
  items: T[],
  total: number
): LoadMoreState<T> {
  return { items, nextPage: 2, status: "idle", total };
}

export function loadMoreReducer<T>(
  state: LoadMoreState<T>,
  action: LoadMoreAction<T>
): LoadMoreState<T> {
  switch (action.type) {
    case "start":
      // Identity return, not a new object: a second start while a page is in
      // flight must be a genuine no-op so React bails out of the re-render.
      return state.status === "loading"
        ? state
        : { ...state, status: "loading" };
    case "loaded":
      return {
        items: [...state.items, ...action.rows],
        nextPage: state.nextPage + 1,
        status: "idle",
        // The set can shrink under us — a row unpublished between pages.
        total: action.total,
      };
    case "failed":
      // `nextPage` deliberately does not advance, so a retry re-requests the
      // page that failed rather than skipping it.
      return { ...state, status: "error" };
    default:
      return state;
  }
}

export function canLoadMore<T>(state: LoadMoreState<T>): boolean {
  if (state.status === "loading" || state.items.length >= state.total) {
    return false;
  }
  // Appwrite rejects an offset past MAX_OFFSET, so a page beyond it must never
  // be offered even when rows remain.
  return (state.nextPage - 1) * WEB_PAGE_SIZE <= MAX_OFFSET;
}

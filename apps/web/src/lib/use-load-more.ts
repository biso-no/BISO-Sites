"use client";

import { useCallback, useReducer, useRef } from "react";
import {
  canLoadMore as canLoadMoreState,
  initialLoadMoreState,
  type LoadMoreState,
  loadMoreReducer,
} from "./load-more-state";

interface UseLoadMoreArgs<T> {
  fetchPage: (page: number) => Promise<{ rows: T[]; total: number }>;
  /** The server-rendered first page. */
  initial: T[];
  /** Appwrite's total for the filtered set, from the same render. */
  total: number;
}

/**
 * Appends successive pages onto a server-rendered first page.
 *
 * Deliberately does NOT watch `initial`. A filter change re-renders the page
 * with new props, and the surface resets this hook by remounting the client
 * component with a new `key`. Syncing `initial` in an effect instead would
 * append page 2 of the previous filter onto page 1 of the new one.
 *
 * All the state transitions live in `./load-more-state` so they can be tested
 * without a DOM — this repo has no jsdom or testing-library, by choice.
 */
export function useLoadMore<T>({
  initial,
  total,
  fetchPage,
}: UseLoadMoreArgs<T>) {
  const [state, dispatch] = useReducer(
    loadMoreReducer as (
      s: LoadMoreState<T>,
      a: Parameters<typeof loadMoreReducer<T>>[1]
    ) => LoadMoreState<T>,
    undefined,
    () => initialLoadMoreState(initial, total)
  );
  // The reducer already refuses a second `start` while loading, but two clicks
  // in ONE tick both read the same pre-dispatch state, so the guard has to be
  // a ref as well to stop a duplicate request going out.
  const inFlight = useRef(false);

  const loadMore = useCallback(() => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    dispatch({ type: "start" });

    fetchPage(state.nextPage)
      .then((result) => {
        dispatch({ type: "loaded", rows: result.rows, total: result.total });
      })
      .catch((cause) => {
        console.error("Failed to load more rows:", cause);
        dispatch({ type: "failed" });
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [fetchPage, state.nextPage]);

  return {
    canLoadMore: canLoadMoreState(state),
    error: state.status === "error",
    isLoading: state.status === "loading",
    items: state.items,
    loadMore,
    total: state.total,
  };
}

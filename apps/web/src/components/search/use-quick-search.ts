"use client";

import type { QuickSearchResponse } from "@repo/shared/search/response";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchSearch } from "@/lib/search/fetch";

export type QuickSearchState =
  | { status: "idle" }
  | { status: "loading"; previous: QuickSearchResponse | null }
  | { status: "ready"; response: QuickSearchResponse }
  | { status: "error" };

export const QUICK_SEARCH_DEBOUNCE_MS = 150;

interface UseQuickSearchOptions {
  campus: string | null;
  debounceMs?: number;
  fetcher?: typeof fetchSearch;
  locale: "no" | "en";
}

/** What the request settled to, tagged with the request it answered. */
type Settled =
  | { key: string; response: QuickSearchResponse; status: "ready" }
  | { key: string; status: "error" };

/** The response the results show for a state: the answer, or the one kept while loading. */
export function shownResponse(
  state: QuickSearchState
): QuickSearchResponse | null {
  if (state.status === "ready") {
    return state.response;
  }
  return state.status === "loading" ? state.previous : null;
}

/**
 * Quick search as you type: debounced, one `AbortController` per request, and
 * a sequence number so an answer is applied only when it belongs to the latest
 * request. A slow answer to "winte" that arrives after "winter" is dropped even
 * if the fetcher ignored the abort.
 */
export function useQuickSearch({
  locale,
  campus,
  debounceMs = QUICK_SEARCH_DEBOUNCE_MS,
  fetcher = fetchSearch,
}: UseQuickSearchOptions): {
  query: string;
  setQuery: (q: string) => void;
  state: QuickSearchState;
} {
  const [query, setRawQuery] = useState("");
  const [settled, setSettled] = useState<Settled | null>(null);
  const latest = useRef(0);
  // Read through a ref so a caller passing a new function each render does
  // not restart the request (and loop on its own answer).
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const q = query.trim();
  const key = q ? JSON.stringify([q, locale, campus]) : "";

  useEffect(() => {
    latest.current += 1;
    const seq = latest.current;
    if (!key) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetcherRef.current(
          { q, locale, campus, mode: "quick" },
          { signal: controller.signal }
        );
        if (seq === latest.current) {
          setSettled({ key, response, status: "ready" });
        }
      } catch {
        if (seq === latest.current && !controller.signal.aborted) {
          setSettled({ key, status: "error" });
        }
      }
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, q, locale, campus, debounceMs]);

  const setQuery = useCallback((next: string) => {
    setRawQuery(next);
    // Clearing the field forgets the old results, so the next search does not
    // briefly show answers to a question nobody is asking any more.
    if (!next.trim()) {
      setSettled(null);
    }
  }, []);

  const state = useMemo(() => stateFor(key, settled), [key, settled]);

  return { query, setQuery, state };
}

function stateFor(key: string, settled: Settled | null): QuickSearchState {
  if (!key) {
    return { status: "idle" };
  }
  if (settled?.key === key) {
    return settled.status === "ready"
      ? { status: "ready", response: settled.response }
      : { status: "error" };
  }
  return {
    status: "loading",
    previous: settled?.status === "ready" ? settled.response : null,
  };
}

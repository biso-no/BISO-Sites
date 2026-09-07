"use client";

import { useEffect, useState } from "react";
import { usePageFeedSnapshot } from "./page-feed-context";

interface AutoFeedParams<T> {
  /** False when the block has nothing to fetch (no department, manual mode). */
  enabled: boolean;
  /** `pageFeedKey(...)` — the identity the host resolved this feed under. */
  key: string;
  /**
   * Pull the items out of the endpoint's payload. Must be defined at module
   * scope: it is an effect dependency, so a fresh closure per render would
   * refetch on every render.
   */
  select?: (payload: unknown) => T[];
  /** Relative endpoint the editor canvas falls back to. */
  url: string;
}

interface AutoFeedResult<T> {
  /** Resolved rows, or null while the feed is still being fetched. */
  items: T[] | null;
  loading: boolean;
}

const identitySelect = <T>(payload: unknown): T[] =>
  Array.isArray(payload) ? (payload as T[]) : [];

/**
 * Resolve one auto-source feed, server-first.
 *
 * The public site resolves feeds on the server and passes them down through
 * `PageFeedProvider`, so the state initializer below already holds real rows
 * during `renderToString`. Hydration runs the same initializer against the
 * same provider value and therefore produces the same markup — there is no
 * mismatch to correct — and the effect finds the key already resolved and
 * never fetches. That is what puts feed content in the HTML for crawlers.
 *
 * The admin canvas mounts no provider, so nothing is seeded, the effect
 * fetches over HTTP, and changing the page's department produces a new key and
 * a fresh fetch. That keeps the editor preview live, which is the reason the
 * blocks cannot simply become Server Components.
 *
 * Resolved feeds are kept as a map rather than a single value so that flipping
 * a department back and forth in the editor does not re-render "Loading…" over
 * rows that were already fetched.
 */
export function useAutoFeed<T>({
  enabled,
  key,
  select = identitySelect,
  url,
}: AutoFeedParams<T>): AutoFeedResult<T> {
  const feeds = usePageFeedSnapshot();
  const [fetched, setFetched] = useState<Record<string, T[]>>(() => ({}));

  useEffect(() => {
    // Already resolved — either the host handed it to us before this component
    // ever rendered, or an earlier fetch did. Refetching would re-render the
    // same rows and, on the public site, would defeat the whole point of
    // resolving on the server.
    if (!enabled || fetched[key] || feeds[key]) {
      return;
    }

    let cancelled = false;
    fetch(url)
      .then((response) => response.json())
      .then((payload: unknown) => {
        if (!cancelled) {
          setFetched((prev) => ({ ...prev, [key]: select(payload) }));
        }
      })
      .catch(() => {
        // A failed feed is empty, not perpetually loading: an unreachable
        // endpoint used to leave "Loading…" on the page forever.
        if (!cancelled) {
          setFetched((prev) => ({ ...prev, [key]: [] }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, feeds, fetched, key, select, url]);

  const items = enabled
    ? (fetched[key] ?? (feeds[key] as T[] | undefined) ?? null)
    : null;
  return { items, loading: enabled && items === null };
}

"use client";

import { usePageFeedSource } from "@/editor/page-feed-context";
import {
  feedBlockLimit,
  pageFeedKey,
  resolveFeedDepartment,
} from "@/editor/page-feeds";
import type { EditorLocale } from "@/editor/types";
import { useAutoFeed } from "@/editor/use-auto-feed";
import { listOf } from "./list";

interface BlockFeed<T> {
  /** The department the block reads from; empty when none is chosen. */
  dept: string;
  /** Rows to show (already sliced to `limit`), or null while unresolved. */
  items: T[] | null;
  locale: EditorLocale;
}

/**
 * The feed behind an events, news or jobs block, sized to its `limit`.
 *
 * The key, the request URL and the slice all use one normalized limit, so the
 * host's snapshot (`collectPageFeedRequests`) and the block agree on which
 * feed this is.
 */
export function useBlockFeed<T extends object>(
  kind: "events" | "jobs" | "news",
  source: string | undefined,
  limitValue: unknown
): BlockFeed<T> {
  const { department, locale } = usePageFeedSource();
  const dept = resolveFeedDepartment(source, department);
  const limit = feedBlockLimit(limitValue);
  const { items } = useAutoFeed<T>({
    enabled: !!dept,
    key: pageFeedKey(kind, dept, locale, limit),
    url: `/api/pages/${kind}?dept=${encodeURIComponent(dept)}&locale=${locale}&limit=${limit}`,
  });
  return {
    dept,
    items: items === null ? null : listOf<T>(items).slice(0, limit),
    locale,
  };
}

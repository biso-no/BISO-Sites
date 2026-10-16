"use client";

import type { Events, EventsCategory } from "@repo/api/types/appwrite";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback } from "react";
import { listEvents } from "@/app/actions/events";
import { CardGrid } from "@/components/ui/card-grid";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { WEB_PAGE_SIZE } from "@/lib/list-params";
import { useLoadMore } from "@/lib/use-load-more";
import { EventCardV2, eventCardLabels } from "./event-card-v2";
import { islandTotalAfterPage } from "./event-fields";

/**
 * The `/events` grid as one list: page 1 arrives server-rendered as
 * `children`, and "Load more" appends the pages after it through
 * `listEvents` — the same server action, with the same filters, that produced
 * page 1.
 *
 * The first page stays server-rendered (no client work, in the HTML a crawler
 * reads) while the appended cards render here from the same `EventCardV2`, so
 * the list is a single `<ul>` rather than a server list and a second one
 * stacked under it.
 *
 * The parent remounts this with a `key` built from the filter tuple, so a new
 * campus, category or search starts over at page 1 instead of appending page 2
 * of the previous filter (see `useLoadMore`).
 *
 * The hook only ever holds what this island appended: page 1 is `children`, so
 * it starts empty and counts the rows still to come — `total` less the first
 * page.
 */
export interface EventsFeedListProps {
  /** Campus id, or `"all"`, exactly as page 1 was fetched. */
  campus: string;
  category: EventsCategory | null;
  /** The server-rendered first page of `<EventCardV2>`s. */
  children: ReactNode;
  firstPageCount: number;
  isMember: boolean;
  locale: "en" | "no";
  search: string;
  /** Rows matching the filters across every page. */
  total: number;
}

export function EventsFeedList({
  campus,
  category,
  children,
  firstPageCount,
  isMember,
  locale,
  search,
  total,
}: EventsFeedListProps) {
  const t = useTranslations("events");
  const labels = eventCardLabels(t);

  const fetchPage = useCallback(
    async (page: number) => {
      const result = await listEvents({
        campus,
        category,
        locale,
        page,
        search,
        upcomingOnly: true,
      });
      return {
        rows: result.rows,
        total: islandTotalAfterPage({
          firstPageCount,
          page,
          pageRows: result.rows.length,
          pageSize: WEB_PAGE_SIZE,
          reportedTotal: result.total,
        }),
      };
    },
    [campus, category, firstPageCount, locale, search]
  );

  const { canLoadMore, error, isLoading, items, loadMore } =
    useLoadMore<Events>({
      initial: [],
      total: total - firstPageCount,
      fetchPage,
    });

  return (
    <>
      <CardGrid className="gap-x-6 gap-y-10">
        {children}
        {items.map((event) => (
          <EventCardV2
            event={event}
            isMember={isMember}
            key={event.$id}
            labels={labels}
            locale={locale}
          />
        ))}
      </CardGrid>

      <LoadMoreButton
        canLoadMore={canLoadMore}
        error={error}
        isLoading={isLoading}
        label={t("filters.loadMore")}
        loadingLabel={t("filters.loading")}
        onLoadMore={loadMore}
        retryLabel={t("filters.loadMoreFailed")}
      />
    </>
  );
}

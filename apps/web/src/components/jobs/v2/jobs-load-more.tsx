"use client";

import { type ReactNode, useCallback } from "react";
import { type JobSort, listJobs } from "@/app/actions/jobs";
import { CardGrid } from "@/components/ui/card-grid";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { WEB_PAGE_SIZE } from "@/lib/list-params";
import { useLoadMore } from "@/lib/use-load-more";
import {
  JobCard,
  type JobCardLabels,
  type JobCardModel,
  toJobCardModel,
} from "./job-card";
import { islandTotalAfterPage } from "./paging";

export interface JobsLoadMoreLabels extends JobCardLabels {
  loading: string;
  loadMore: string;
  loadMoreFailed: string;
}

export interface JobsLoadMoreProps {
  /** Campus id as the server page was fetched, or null for every campus. */
  campus: string | null;
  category: string | null;
  /** The server-rendered page of `<JobCard>`s. */
  children: ReactNode;
  department: string | null;
  /** Ids on the server-rendered page, so a drifted page never repeats one. */
  firstPageIds: string[];
  labels: JobsLoadMoreLabels;
  locale: string;
  search: string;
  sort: JobSort;
  /** The page the server rendered — 1 unless the URL asked for another. */
  startPage: number;
  /** Rows matching the filters, as counted for the heading line. */
  total: number;
}

/**
 * The `/jobs` grid as one list: the server-rendered page arrives as
 * `children`, and "Load more" appends the pages after it through `listJobs` —
 * the same server action, with the same filters — rendered with the same
 * `JobCard`. One `<ul>`, so the list a screen reader announces is the list on
 * screen.
 *
 * The parent remounts this with a `key` built from the filter tuple, so a new
 * filter starts over instead of appending onto the old one's rows —
 * `useLoadMore` deliberately does not watch its props.
 *
 * The hook holds only what this island appends, and counts the hook's pages
 * from 2. Those map onto the pages after the one the server rendered, which is
 * not page 1 when the URL asked for another.
 */
export function JobsLoadMore({
  campus,
  category,
  children,
  department,
  firstPageIds,
  labels,
  locale,
  search,
  sort,
  startPage,
  total,
}: JobsLoadMoreProps) {
  const shownBefore = (startPage - 1) * WEB_PAGE_SIZE + firstPageIds.length;

  const fetchPage = useCallback(
    async (page: number) => {
      const result = await listJobs({
        campus,
        category,
        department,
        locale,
        page: page + startPage - 1,
        search,
        sort,
      });
      return {
        rows: result.rows.map((job) => toJobCardModel(job, locale)),
        total: islandTotalAfterPage({
          page,
          pageRows: result.rows.length,
          pageSize: WEB_PAGE_SIZE,
          reportedTotal: result.total,
          shownBefore,
        }),
      };
    },
    [campus, category, department, locale, search, shownBefore, sort, startPage]
  );

  const { canLoadMore, error, isLoading, items, loadMore } =
    useLoadMore<JobCardModel>({
      fetchPage,
      initial: [],
      total: Math.max(0, total - shownBefore),
    });

  // Offset paging drifts when a vacancy is published between two clicks: the
  // newest-first order shifts by one and the next page repeats a row already
  // shown. Render each vacancy once rather than twice under one key.
  const seen = new Set(firstPageIds);
  const appended = items.filter((job) => {
    if (seen.has(job.id)) {
      return false;
    }
    seen.add(job.id);
    return true;
  });

  return (
    <>
      <CardGrid>
        {children}
        {appended.map((job) => (
          <JobCard job={job} key={job.id} labels={labels} />
        ))}
      </CardGrid>

      <LoadMoreButton
        canLoadMore={canLoadMore}
        error={error}
        isLoading={isLoading}
        label={labels.loadMore}
        loadingLabel={labels.loading}
        onLoadMore={loadMore}
        retryLabel={labels.loadMoreFailed}
      />
    </>
  );
}

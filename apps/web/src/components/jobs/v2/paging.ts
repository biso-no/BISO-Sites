/**
 * Counting the `/jobs` feed without trusting Appwrite's total.
 *
 * `countRows` in `lib/data/queries.ts` records that `listRows(...).total` now
 * reports the size of the whole table rather than the filtered set, and
 * `listJobs` passes that figure through as `total`. A page shorter than a full
 * page is the last one, though, so wherever a short page has been seen the
 * count is exact; only while every page so far was full is the reported total
 * all there is. Where the reported total is right, every figure here equals it.
 *
 * Pure, so it is tested without the server action behind it.
 */

/** Rows matching the filters, as shown above the grid. */
export function feedTotal({
  pageRows,
  pageSize,
  reportedTotal,
  startPage,
}: {
  /** Rows on the page the server rendered. */
  pageRows: number;
  pageSize: number;
  reportedTotal: number;
  /** The page the server rendered — 1 unless the URL asked for another. */
  startPage: number;
}): number {
  const throughThisPage = (startPage - 1) * pageSize + pageRows;
  return pageRows < pageSize
    ? throughThisPage
    : Math.max(reportedTotal, throughThisPage);
}

/**
 * The `total` the "Load more" island tracks after fetching its `page`.
 *
 * The island holds only the rows it appends, so it counts what is still to
 * come after the server's page. `page` is the hook's own page number — its
 * first fetch is 2 — and a short page ends the list: the island then holds
 * everything, so a total that is too big cannot keep offering a "Load more"
 * that loads nothing.
 */
export function islandTotalAfterPage({
  page,
  pageRows,
  pageSize,
  reportedTotal,
  shownBefore,
}: {
  page: number;
  pageRows: number;
  pageSize: number;
  reportedTotal: number;
  /** Rows up to and including the server-rendered page. */
  shownBefore: number;
}): number {
  const appended = (page - 2) * pageSize + pageRows;
  return pageRows < pageSize
    ? appended
    : Math.max(appended, reportedTotal - shownBefore);
}

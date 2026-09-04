"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Orders } from "@repo/api/types/appwrite";
import { requireAuth } from "@/lib/authorization";
import { ordersToCsv } from "@/lib/orders-csv";
import { applyScopeQueries } from "@/lib/utils/authorization";
import {
  listOrderIdsForProduct,
  type OrderFilters,
  orderFilterQueries,
} from "./shop";

/**
 * Rows per round trip. 500 is comfortably under Appwrite's 5000 `Query.limit`
 * ceiling and keeps a single response small enough to hold in memory while the
 * CSV is built.
 */
const EXPORT_PAGE_SIZE = 500;

/**
 * Absolute ceiling on an export, so a runaway filter cannot scan the whole
 * table forever. 20 000 orders is several years of BISO trade (2025: 2625,
 * 2026: 1043) and roughly 40 round trips; past it the caller gets the newest
 * 20 000 matching orders and `truncated: true`, which the UI must surface.
 */
const MAX_EXPORT_ROWS = 20_000;

/**
 * Appwrite expands a value list into an `$id` IN-list and refuses one longer
 * than this, so a product-filtered export queries in chunks of at most 500.
 */
const MAX_ID_FILTER_VALUES = 500;

/**
 * Largest product-id resolution `listOrderIdsForProduct` can actually honour:
 * it scans at most `MAX_ORDER_ITEM_SCAN_PAGES` (20) x `ORDER_ITEM_SCAN_PAGE`
 * (500) line items, so no value above 10 000 means anything and asking for more
 * would only look generous. Past it the resolution reports `truncated`, which
 * this action passes through.
 */
const MAX_PRODUCT_ORDER_IDS = 10_000;

/** Same projection `listOrders` uses, minus the per-item product/variation
 * expansions the CSV never reads — an export can be 20 000 rows deep. */
const EXPORT_SELECT = Query.select(["*", "order_items.*"]);

function chunkIds(ids: string[]): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += MAX_ID_FILTER_VALUES) {
    chunks.push(ids.slice(i, i + MAX_ID_FILTER_VALUES));
  }
  return chunks;
}

type SessionDb = Awaited<ReturnType<typeof createSessionClient>>["db"];

/**
 * Cursor-pages one slice of the filtered set into `rows`, stopping at `budget`.
 * Returns true when the budget ran out, i.e. more rows would have matched.
 *
 * `Query.cursorAfter` rather than `Query.offset`: Appwrite rejects an offset
 * past 5000 and the orders collection is larger than that, so an offset-paged
 * export could never reach the older half of the table.
 *
 * `$createdAt` is NOT a total order — orders placed in the same clock tick tie
 * — and keyset paging over a non-unique sort key normally skips rows at a page
 * boundary. No explicit tiebreaker is added here because Appwrite already
 * appends one: `Database::find` in utopia-php/database appends `$sequence` (the
 * unique internal row id) to the order attributes whenever the caller ordered
 * by neither `$id` nor `$sequence`, in the same direction when the leading
 * attribute is `$createdAt`/`$updatedAt`, and the adapter then chains the
 * cursor condition over every order attribute
 * (`(_createdAt < :c0) OR (_createdAt = :c0 AND _id < :c1)`). Adding
 * `Query.orderDesc("$id")` would suppress that append and replace an
 * index-friendly clustered-key tiebreak with a slower one on `_uid`. If a
 * future Appwrite drops that append, this loop needs an explicit tiebreaker.
 */
async function collectOrderPages(
  db: SessionDb,
  baseQueries: string[],
  rows: Orders[],
  budget: number
): Promise<boolean> {
  // Already full from an earlier chunk, with chunks still to scan: whatever
  // they hold is genuinely missing from the export.
  if (rows.length >= budget) {
    return true;
  }

  let cursor: string | undefined;

  while (rows.length < budget) {
    const queries = [...baseQueries, Query.limit(EXPORT_PAGE_SIZE)];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }

    const response = await db.listRows<Orders>("app", "orders", queries);
    if (response.rows.length === 0) {
      return false;
    }

    const remaining = budget - rows.length;
    rows.push(...response.rows.slice(0, remaining));

    if (response.rows.length > remaining) {
      // Rows had to be dropped, so the ceiling really did bite.
      return true;
    }
    if (response.rows.length < EXPORT_PAGE_SIZE) {
      return false;
    }
    cursor = response.rows.at(-1)?.$id;
    if (!cursor) {
      return false;
    }
  }

  // The budget is a whole number of pages, so the ordinary way to reach it is a
  // full final page — which looks identical to "there is more" and to "the data
  // ended here". One 1-row probe settles it rather than warning the user that a
  // complete export was cut short.
  if (!cursor) {
    return false;
  }
  const probe = await db.listRows<Orders>("app", "orders", [
    ...baseQueries,
    Query.limit(1),
    Query.cursorAfter(cursor),
  ]);
  return probe.rows.length > 0;
}

/**
 * Newest first across the whole export.
 *
 * Each `$id` chunk is paged newest-first on its own, so concatenating them
 * leaves the CSV sorted only WITHIN a chunk — it would silently stop being
 * newest-first exactly when a product-filtered export grows past 500 orders.
 * `$createdAt` ties are broken by `$id` so the order is deterministic.
 */
function sortNewestFirst(rows: Orders[]): Orders[] {
  return [...rows].sort((a, b) => {
    if (a.$createdAt !== b.$createdAt) {
      return a.$createdAt < b.$createdAt ? 1 : -1;
    }
    if (a.$id === b.$id) {
      return 0;
    }
    return a.$id < b.$id ? 1 : -1;
  });
}

/**
 * The FULL filtered order set as a CSV document — not one page.
 *
 * The old client-side export wrote whatever rows happened to be loaded, so a
 * filtered export silently covered at most the visible window. This re-runs the
 * same filters server-side and pages the whole set.
 *
 * Authorization is the same boundary `listOrders` uses — `requireAuth()`, the
 * session client (so `orders` row security applies) and the campus scope on
 * EVERY round trip. This is an exported server action and therefore publicly
 * reachable; it must never become a way to enumerate orders the caller cannot
 * already see in the list.
 */
export async function exportOrdersCsv(input: {
  filters: OrderFilters;
  headers: string[];
}): Promise<{ csv: string; rowCount: number; truncated: boolean }> {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  // A product filter is resolved here rather than by `orderFilterQueries` so
  // the export can raise the id limit and batch the IN-lists itself; the screen
  // only ever needs one 500-id chunk.
  let idChunks: (string[] | null)[] = [null];
  let truncated = false;
  if (input.filters.productId) {
    const resolved = await listOrderIdsForProduct(input.filters.productId, {
      limit: MAX_PRODUCT_ORDER_IDS,
    });
    if (resolved.ids.length === 0) {
      return {
        csv: ordersToCsv([], input.headers),
        rowCount: 0,
        truncated: false,
      };
    }
    idChunks = chunkIds(resolved.ids);
    truncated = resolved.truncated;
  }

  const filters = await orderFilterQueries({
    ...input.filters,
    productId: undefined,
  });
  // Unreachable: only a product filter can prove an empty set, and it is
  // resolved above.
  if (filters === null) {
    return { csv: ordersToCsv([], input.headers), rowCount: 0, truncated };
  }

  const rows: Orders[] = [];
  for (const chunk of idChunks) {
    const baseQueries = [
      Query.orderDesc("$createdAt"),
      EXPORT_SELECT,
      // orders is campus-scoped only (no department column).
      ...applyScopeQueries(ctx, { departmentField: null }),
      ...filters.queries,
    ];
    if (chunk) {
      baseQueries.push(Query.equal("$id", chunk));
    }

    const hitCeiling = await collectOrderPages(
      db,
      baseQueries,
      rows,
      MAX_EXPORT_ROWS
    );
    if (hitCeiling) {
      truncated = true;
      break;
    }
  }

  return {
    csv: ordersToCsv(sortNewestFirst(rows), input.headers),
    rowCount: rows.length,
    truncated,
  };
}

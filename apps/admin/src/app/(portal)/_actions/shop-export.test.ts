import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";

const adminDb = { listRows: mock() };
const sessionDb = { listRows: mock() };

function makeCtx(overrides: Partial<UserAuthContext> = {}): UserAuthContext {
  return {
    activeCampusId: undefined,
    campusNames: [],
    campusTeamIds: [],
    departmentNames: [],
    departmentTeamIds: [],
    email: null,
    managedCampuses: [],
    managedCampusIds: [],
    name: null,
    resolvedCampusIds: [],
    resolvedDepartmentIds: [],
    roles: [],
    userId: "user-1",
    ...overrides,
  };
}

const campusAdminCtx = makeCtx({
  campusNames: ["Oslo"],
  campusTeamIds: ["sg-app-campus-oslo"],
  managedCampuses: ["Oslo"],
  managedCampusIds: ["campus-oslo"],
  resolvedCampusIds: ["campus-oslo"],
  roles: ["campusadmin"],
});

let currentCtx: UserAuthContext = campusAdminCtx;

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: adminDb })),
  createSessionClient: mock(async () => ({ db: sessionDb })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
mock.module("@/lib/recruitment", () => ({
  loadRecruitmentLookups: mock(async () => ({
    campusIdsByName: new Map(),
    campusNamesById: new Map(),
    departmentIdsByName: new Map(),
    departmentNamesById: new Map(),
  })),
}));
mock.module("next/cache", () => ({ revalidatePath: mock(() => undefined) }));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { exportOrdersCsv } = await import("./shop-export");

/** The campus filter `applyScopeQueries` adds to `orders` for `campusAdminCtx`. */
const ORDER_SCOPE = Query.equal("campus_id", ["campus-oslo"]);

const HEADERS = ["Order", "Date", "Buyer"];

type ListRowsArgs = [string, string, string[]];

/** Every `listRows` call the mock saw for one table, as its query array. */
function queriesFor(tableId: string): string[][] {
  return (sessionDb.listRows.mock.calls as ListRowsArgs[])
    .filter((call) => call[1] === tableId)
    .map((call) => call[2]);
}

interface ParsedQuery {
  attribute?: string;
  method: string;
  values?: unknown[];
}

function parseQuery(query: string): ParsedQuery {
  return JSON.parse(query) as ParsedQuery;
}

/** The `Query.limit(n)` the action asked for, so the test need not hard-code it. */
function limitOf(queries: string[]): number {
  for (const query of queries) {
    const parsed = parseQuery(query);
    if (parsed.method === "limit") {
      return Number(parsed.values?.[0]);
    }
  }
  throw new Error("No limit query found");
}

/** The `$id` IN-list values on a query array, or null when there is none. */
function idFilterValues(queries: string[]): string[] | null {
  for (const query of queries) {
    const parsed = parseQuery(query);
    if (parsed.method === "equal" && parsed.attribute === "$id") {
      return (parsed.values ?? []) as string[];
    }
  }
  return null;
}

/** Length of the `$id` IN-list on a query array, or null when there is none. */
function idFilterSize(queries: string[]): number | null {
  for (const query of queries) {
    const parsed = parseQuery(query);
    if (parsed.method === "equal" && parsed.attribute === "$id") {
      return parsed.values?.length ?? 0;
    }
  }
  return null;
}

function makeRows(count: number, offset: number) {
  return Array.from({ length: count }, (_, index) => ({
    $id: `o${offset + index}`,
    $createdAt: "2026-02-03T10:11:12.000Z",
    buyer_name: `Buyer ${offset + index}`,
    items_json: null,
    status: "paid",
    total: 100,
  }));
}

beforeEach(() => {
  currentCtx = campusAdminCtx;
  adminDb.listRows.mockReset();
  sessionDb.listRows.mockReset();
});

describe("exportOrdersCsv", () => {
  test("cursor-pages the full filtered set across several round trips", async () => {
    let round = 0;
    sessionDb.listRows.mockImplementation(
      (_db: string, _tableId: string, queries: string[]) => {
        const limit = limitOf(queries);
        round += 1;
        if (round === 1) {
          return { rows: makeRows(limit, 0), total: 5000 };
        }
        if (round === 2) {
          return { rows: makeRows(limit, limit), total: 5000 };
        }
        return { rows: makeRows(3, limit * 2), total: 5000 };
      }
    );

    const result = await exportOrdersCsv({ filters: {}, headers: HEADERS });

    const calls = queriesFor("orders");
    const limit = limitOf(calls[0] as string[]);
    expect(calls).toHaveLength(3);
    expect(result.rowCount).toBe(limit * 2 + 3);
    expect(result.truncated).toBe(false);
    // header row + one row per order
    expect(result.csv.split("\n")).toHaveLength(limit * 2 + 4);
    expect(result.csv.split("\n")[0]).toBe(HEADERS.join(","));
  });

  test("keeps the scope on every round trip and never uses an offset", async () => {
    let round = 0;
    sessionDb.listRows.mockImplementation(
      (_db: string, _tableId: string, queries: string[]) => {
        const limit = limitOf(queries);
        round += 1;
        return round === 1
          ? { rows: makeRows(limit, 0), total: 900 }
          : { rows: makeRows(2, limit), total: 900 };
      }
    );

    await exportOrdersCsv({ filters: {}, headers: HEADERS });

    const calls = queriesFor("orders");
    expect(calls).toHaveLength(2);
    for (const queries of calls) {
      expect(queries).toContain(ORDER_SCOPE);
      expect(queries.some((query) => query.includes('"offset"'))).toBe(false);
    }
    expect(calls[0]?.some((query) => query.includes("cursorAfter"))).toBe(
      false
    );
    const firstPageLimit = limitOf(calls[0] as string[]);
    expect(calls[1]).toContain(Query.cursorAfter(`o${firstPageLimit - 1}`));
  });

  test("applies the shared order filters", async () => {
    sessionDb.listRows.mockImplementation(() => ({ rows: [], total: 0 }));

    await exportOrdersCsv({
      filters: { from: "2026-01-01", to: "2026-01-31", q: "andreas" },
      headers: HEADERS,
    });

    const queries = queriesFor("orders")[0] as string[];
    expect(queries).toContain(
      Query.between(
        "$createdAt",
        "2026-01-01T00:00:00.000Z",
        "2026-01-31T23:59:59.999Z"
      )
    );
    expect(queries.some((query) => query.includes('"or"'))).toBe(true);
    expect(queries).toContain(ORDER_SCOPE);
  });

  test("batches a product filter's ids in chunks of at most 500", async () => {
    let itemRound = 0;
    sessionDb.listRows.mockImplementation((_db: string, tableId: string) => {
      if (tableId === "order_items") {
        itemRound += 1;
        if (itemRound <= 2) {
          const base = (itemRound - 1) * 500;
          return {
            rows: Array.from({ length: 500 }, (_, index) => ({
              $id: `i${base + index}`,
              order: { $id: `o${base + index}` },
            })),
            total: 1200,
          };
        }
        return {
          rows: Array.from({ length: 200 }, (_, index) => ({
            $id: `i${1000 + index}`,
            order: { $id: `o${1000 + index}` },
          })),
          total: 1200,
        };
      }
      return { rows: [], total: 0 };
    });

    const result = await exportOrdersCsv({
      filters: { productId: "prod-1" },
      headers: HEADERS,
    });

    const calls = queriesFor("orders");
    expect(calls).toHaveLength(3);
    expect(calls.map((queries) => idFilterSize(queries))).toEqual([
      500, 500, 200,
    ]);
    for (const queries of calls) {
      expect(queries).toContain(ORDER_SCOPE);
    }
    // The screen resolves at most 500 ids and would have stopped after the
    // first order_items round; the export must raise that limit.
    expect(queriesFor("order_items")).toHaveLength(3);
    expect(result.truncated).toBe(false);
  });

  test("returns a header-only csv when a product filter matches no orders", async () => {
    sessionDb.listRows.mockImplementation(() => ({ rows: [], total: 0 }));

    const result = await exportOrdersCsv({
      filters: { productId: "prod-none" },
      headers: HEADERS,
    });

    expect(result).toEqual({
      csv: HEADERS.join(","),
      rowCount: 0,
      truncated: false,
    });
    expect(queriesFor("orders")).toHaveLength(0);
  });

  test("returns a header-only csv when nothing matches", async () => {
    sessionDb.listRows.mockImplementation(() => ({ rows: [], total: 0 }));

    const result = await exportOrdersCsv({ filters: {}, headers: HEADERS });

    expect(result.rowCount).toBe(0);
    expect(result.csv).toBe(HEADERS.join(","));
    expect(result.truncated).toBe(false);
  });

  test("returns a product-filtered export newest first across chunks", async () => {
    // 600 matching ids -> two `$id` chunks. The NEWEST order lives in the
    // second chunk, so concatenating the chunks in resolution order would put
    // an older order first.
    let itemRound = 0;
    sessionDb.listRows.mockImplementation(
      (_db: string, tableId: string, queries: string[]) => {
        if (tableId === "order_items") {
          itemRound += 1;
          if (itemRound === 1) {
            return {
              rows: Array.from({ length: 500 }, (_, index) => ({
                $id: `i${index}`,
                order: { $id: `o${index}` },
              })),
              total: 600,
            };
          }
          return {
            rows: Array.from({ length: 100 }, (_, index) => ({
              $id: `i${500 + index}`,
              order: { $id: `o${500 + index}` },
            })),
            total: 600,
          };
        }

        const ids = idFilterValues(queries);
        return ids?.[0] === "o0"
          ? {
              rows: [
                {
                  $id: "older",
                  $createdAt: "2026-01-01T00:00:00.000Z",
                  buyer_name: "Older",
                  items_json: null,
                },
              ],
              total: 1,
            }
          : {
              rows: [
                {
                  $id: "newest",
                  $createdAt: "2026-06-01T00:00:00.000Z",
                  buyer_name: "Newest",
                  items_json: null,
                },
              ],
              total: 1,
            };
      }
    );

    const result = await exportOrdersCsv({
      filters: { productId: "prod-1" },
      headers: HEADERS,
    });

    const lines = result.csv.split("\n");
    expect(result.rowCount).toBe(2);
    expect(lines[1]).toContain("newest");
    expect(lines[2]).toContain("older");
  });

  test("does not report truncation when the source ends exactly at the ceiling", async () => {
    // Phase 1: an endless source, purely to discover the ceiling without the
    // test hard-coding it.
    let served = 0;
    sessionDb.listRows.mockImplementation(
      (_db: string, _tableId: string, queries: string[]) => {
        const limit = limitOf(queries);
        const rows = makeRows(limit, served);
        served += limit;
        return { rows, total: 100_000 };
      }
    );
    const ceiling = (await exportOrdersCsv({ filters: {}, headers: HEADERS }))
      .rowCount;
    expect(ceiling).toBeGreaterThan(5000);

    // Phase 2: a source holding EXACTLY `ceiling` rows, so the final page is
    // full and the budget is filled at the very moment the data runs out.
    sessionDb.listRows.mockReset();
    let sent = 0;
    sessionDb.listRows.mockImplementation(
      (_db: string, _tableId: string, queries: string[]) => {
        const limit = limitOf(queries);
        const count = Math.min(limit, Math.max(0, ceiling - sent));
        const rows = makeRows(count, sent);
        sent += count;
        return { rows, total: ceiling };
      }
    );

    const result = await exportOrdersCsv({ filters: {}, headers: HEADERS });

    expect(result.rowCount).toBe(ceiling);
    expect(result.truncated).toBe(false);
  });

  test("stops at the row ceiling and reports truncation", async () => {
    let cursor = 0;
    sessionDb.listRows.mockImplementation(
      (_db: string, _tableId: string, queries: string[]) => {
        const limit = limitOf(queries);
        const rows = makeRows(limit, cursor);
        cursor += limit;
        return { rows, total: 100_000 };
      }
    );

    const result = await exportOrdersCsv({ filters: {}, headers: HEADERS });

    expect(result.truncated).toBe(true);
    // The ceiling must actually bite before the mock runs forever, and it
    // stops on a whole page. (Round-trip count is not asserted: reaching the
    // ceiling costs one extra 1-row probe — see `collectOrderPages`.)
    const pageSize = limitOf(queriesFor("orders")[0] as string[]);
    expect(result.rowCount).toBeGreaterThan(5000);
    expect(result.rowCount % pageSize).toBe(0);
  });
});

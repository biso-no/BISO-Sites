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

const {
  countOrderStats,
  countProductStats,
  listOrderIdsForProduct,
  listOrderProductOptions,
  listOrders,
  listProducts,
} = await import("./shop");

/** The campus filter `applyContentRelationshipScopeQueries` adds for `campusAdminCtx`. */
const PRODUCT_SCOPE = Query.equal("campus.$id", ["campus-oslo"]);
/** The campus filter `applyScopeQueries` adds to `orders` for `campusAdminCtx`. */
const ORDER_SCOPE = Query.equal("campus_id", ["campus-oslo"]);

type ListRowsArgs = [string, string, string[]];

/** Every `listRows` call the mock saw for one table, as its query array. */
function queriesFor(
  db: { listRows: ReturnType<typeof mock> },
  tableId: string
): string[][] {
  return (db.listRows.mock.calls as ListRowsArgs[])
    .filter((call) => call[1] === tableId)
    .map((call) => call[2]);
}

/** The queries of the single expected read for a table; throws if there were more. */
function onlyQueriesFor(
  db: { listRows: ReturnType<typeof mock> },
  tableId: string
): string[] {
  const calls = queriesFor(db, tableId);
  if (calls.length !== 1) {
    throw new Error(
      `Expected exactly one ${tableId} read, saw ${calls.length}.`
    );
  }
  return calls[0] as string[];
}

beforeEach(() => {
  currentCtx = campusAdminCtx;
  adminDb.listRows.mockReset();
  sessionDb.listRows.mockReset();
});

// ─── Products ────────────────────────────────────────────────────────────────

describe("listProducts pagination", () => {
  test("reports the true total and offsets, keeping the relationship scope", async () => {
    adminDb.listRows.mockImplementation((_db: string, tableId: string) =>
      tableId === "webshop_products"
        ? { rows: [{ $id: "p1" }], total: 57 }
        : { rows: [], total: 0 }
    );

    const result = await listProducts({ page: 3, size: 25, q: "" });

    expect(result.total).toBe(57);
    expect(result.page).toBe(3);
    expect(result.size).toBe(25);
    expect(result.rows).toHaveLength(1);

    const queries = onlyQueriesFor(adminDb, "webshop_products");
    expect(queries).toContain(Query.limit(25));
    expect(queries).toContain(Query.offset(50));
    expect(queries).toContain(Query.orderDesc("$updatedAt"));
    expect(queries).toContain(Query.select(["*", "variations.*"]));
    expect(queries).toContain(PRODUCT_SCOPE);
  });

  test("hydrates translations for the visible page only", async () => {
    adminDb.listRows.mockImplementation((_db: string, tableId: string) =>
      tableId === "webshop_products"
        ? { rows: [{ $id: "p1" }, { $id: "p2" }], total: 2 }
        : {
            rows: [
              { $id: "t1", content_id: "p1", locale: "no", title: "Genser" },
            ],
            total: 1,
          }
    );

    const result = await listProducts({ page: 1, size: 25, q: "" });

    expect(result.rows[0]?.translation_refs).toHaveLength(1);
    expect(result.rows[1]?.translation_refs).toHaveLength(0);
    const queries = onlyQueriesFor(adminDb, "content_translations");
    expect(queries).toContain(Query.equal("content_id", ["p1", "p2"]));
  });

  test("searches translated titles and slugs while keeping scope and paging", async () => {
    adminDb.listRows.mockImplementation((_db: string, tableId: string) => {
      if (tableId === "content_translations") {
        return {
          rows: [
            { $id: "t1", content_id: "p1" },
            { $id: "t2", content_id: "p1" },
            { $id: "t3", content_id: "p2" },
          ],
          total: 3,
        };
      }
      return { rows: [], total: 0 };
    });

    await listProducts({ page: 2, size: 25, q: "genser" });

    const searchQueries = queriesFor(adminDb, "content_translations")[0] ?? [];
    expect(searchQueries).toContain(Query.equal("content_type", "product"));
    expect(searchQueries).toContain(Query.search("title", "genser"));

    const queries = onlyQueriesFor(adminDb, "webshop_products");
    expect(queries).toContain(
      Query.or([
        Query.equal("$id", ["p1", "p2"]),
        Query.contains("slug", "genser"),
      ])
    );
    expect(queries).toContain(PRODUCT_SCOPE);
    expect(queries).toContain(Query.offset(25));
  });

  test("falls back to a slug match when no title matches", async () => {
    adminDb.listRows.mockImplementation(() => ({ rows: [], total: 0 }));

    await listProducts({ page: 1, size: 25, q: "zzz" });

    const queries = onlyQueriesFor(adminDb, "webshop_products");
    expect(queries).toContain(Query.contains("slug", "zzz"));
    expect(queries.some((query) => query.includes('"or"'))).toBe(false);
    expect(queries).toContain(PRODUCT_SCOPE);
  });

  test("keeps status and category filters alongside the scope", async () => {
    adminDb.listRows.mockImplementation(() => ({ rows: [], total: 0 }));

    await listProducts({
      page: 1,
      size: 50,
      q: "",
      status: "published",
      category: "apparel",
    });

    const queries = onlyQueriesFor(adminDb, "webshop_products");
    expect(queries).toContain(Query.equal("status", "published"));
    expect(queries).toContain(Query.equal("category", "apparel"));
    expect(queries).toContain(PRODUCT_SCOPE);
  });
});

describe("countProductStats", () => {
  test("tallies the full scoped set rather than a page", async () => {
    adminDb.listRows.mockImplementation(() => ({
      rows: [
        { $id: "p1", status: "published", inventory_mode: "tracked", stock: 2 },
        {
          $id: "p2",
          status: "published",
          inventory_mode: "unlimited",
          stock: null,
        },
        { $id: "p3", status: "draft", inventory_mode: "tracked", stock: 12 },
        {
          $id: "p4",
          status: "pending_approval",
          inventory_mode: "tracked",
          stock: 0,
        },
        {
          $id: "p5",
          status: "archived",
          inventory_mode: "unlimited",
          stock: null,
        },
      ],
      total: 57,
    }));

    const stats = await countProductStats();

    expect(stats).toEqual({
      all: 57,
      published: 2,
      drafts: 1,
      pending: 1,
      archived: 1,
      lowStock: 2,
    });

    const queries = onlyQueriesFor(adminDb, "webshop_products");
    expect(queries).toContain(
      Query.select(["$id", "status", "inventory_mode", "stock"])
    );
    expect(queries).toContain(PRODUCT_SCOPE);
    expect(queries.some((query) => query.includes('"offset"'))).toBe(false);
  });

  test("counts only the category the catalog is filtered to", async () => {
    adminDb.listRows.mockImplementation(() => ({
      rows: [
        { $id: "p1", status: "published", inventory_mode: "tracked", stock: 1 },
      ],
      total: 4,
    }));

    const stats = await countProductStats({ category: "apparel" });

    expect(stats.all).toBe(4);
    expect(stats.published).toBe(1);
    const queries = onlyQueriesFor(adminDb, "webshop_products");
    expect(queries).toContain(Query.equal("category", "apparel"));
    expect(queries).toContain(PRODUCT_SCOPE);
  });

  test("counts the same search intersection the list pages", async () => {
    adminDb.listRows.mockImplementation((_db: string, tableId: string) =>
      tableId === "content_translations"
        ? { rows: [{ $id: "t1", content_id: "p9" }], total: 1 }
        : {
            rows: [
              {
                $id: "p9",
                status: "published",
                inventory_mode: "unlimited",
                stock: null,
              },
            ],
            total: 1,
          }
    );

    const stats = await countProductStats({ q: "genser" });

    expect(stats.all).toBe(1);
    expect(stats.published).toBe(1);
    const queries = onlyQueriesFor(adminDb, "webshop_products");
    const orClause = queries.find((query) => query.includes('"or"'));
    expect(orClause).toBeDefined();
    expect(orClause).toContain("p9");
    expect(orClause).toContain("slug");
    expect(queries).toContain(PRODUCT_SCOPE);
  });

  test("falls back to a slug-only match when no title matches", async () => {
    adminDb.listRows.mockImplementation((_db: string, tableId: string) =>
      tableId === "content_translations"
        ? { rows: [], total: 0 }
        : { rows: [], total: 0 }
    );

    const stats = await countProductStats({ q: "booklocker" });

    expect(stats.all).toBe(0);
    const queries = onlyQueriesFor(adminDb, "webshop_products");
    // A single-clause `Query.or` is rejected by Appwrite.
    expect(queries).toContain(Query.contains("slug", "booklocker"));
    expect(queries.some((query) => query.includes('"or"'))).toBe(false);
    expect(queries).toContain(PRODUCT_SCOPE);
  });

  test("keeps the scope under every filter combination", async () => {
    adminDb.listRows.mockImplementation((_db: string, tableId: string) =>
      tableId === "content_translations"
        ? { rows: [{ $id: "t1", content_id: "p9" }], total: 1 }
        : { rows: [], total: 0 }
    );

    await countProductStats({ category: "apparel", q: "genser" });

    const queries = onlyQueriesFor(adminDb, "webshop_products");
    expect(queries).toContain(PRODUCT_SCOPE);
    expect(queries).toContain(Query.equal("category", "apparel"));
    expect(queries.some((query) => query.includes('"or"'))).toBe(true);
    // A status filter would collapse the per-status chips to one number; the
    // projection mentions `status`, a filter on it would not be a `select`.
    const statusFilters = queries.filter(
      (query) =>
        query.includes('"status"') && !query.includes('"method":"select"')
    );
    expect(statusFilters).toEqual([]);
  });
});

// ─── Orders ──────────────────────────────────────────────────────────────────

describe("listOrders pagination", () => {
  test("reports the true total and offsets, keeping the session scope", async () => {
    sessionDb.listRows.mockImplementation(() => ({
      rows: [{ $id: "o1" }],
      total: 5000,
    }));

    const result = await listOrders({ page: 2, size: 100, q: "" });

    expect(result.total).toBe(5000);
    expect(result.page).toBe(2);
    const queries = onlyQueriesFor(sessionDb, "orders");
    expect(queries).toContain(Query.limit(100));
    expect(queries).toContain(Query.offset(100));
    expect(queries).toContain(Query.orderDesc("$createdAt"));
    expect(queries).toContain(ORDER_SCOPE);
    expect(adminDb.listRows).not.toHaveBeenCalled();
  });

  test("filters a two-sided date range with a single between", async () => {
    sessionDb.listRows.mockImplementation(() => ({ rows: [], total: 0 }));

    await listOrders({
      page: 1,
      size: 25,
      q: "",
      from: "2026-01-01",
      to: "2026-12-31",
    });

    const queries = onlyQueriesFor(sessionDb, "orders");
    expect(queries).toContain(
      Query.between(
        "$createdAt",
        "2026-01-01T00:00:00.000Z",
        "2026-12-31T23:59:59.999Z"
      )
    );
  });

  test("handles one-sided date ranges", async () => {
    sessionDb.listRows.mockImplementation(() => ({ rows: [], total: 0 }));

    await listOrders({ page: 1, size: 25, q: "", from: "2026-01-01" });
    expect(onlyQueriesFor(sessionDb, "orders")).toContain(
      Query.greaterThanEqual("$createdAt", "2026-01-01T00:00:00.000Z")
    );

    sessionDb.listRows.mockReset();
    sessionDb.listRows.mockImplementation(() => ({ rows: [], total: 0 }));
    await listOrders({ page: 1, size: 25, q: "", to: "2026-12-31" });
    expect(onlyQueriesFor(sessionDb, "orders")).toContain(
      Query.lessThanEqual("$createdAt", "2026-12-31T23:59:59.999Z")
    );
  });

  test("searches buyer name and email", async () => {
    sessionDb.listRows.mockImplementation(() => ({ rows: [], total: 0 }));

    await listOrders({ page: 1, size: 25, q: "andreas" });

    const queries = onlyQueriesFor(sessionDb, "orders");
    const orClause = queries.find((query) => query.includes('"or"'));
    expect(orClause).toBeDefined();
    expect(orClause).toContain("buyer_name");
    expect(orClause).toContain("buyer_email");
  });

  test("resolves a product filter through order_items, never a nested query", async () => {
    sessionDb.listRows.mockImplementation((_db: string, tableId: string) => {
      if (tableId === "order_items") {
        return {
          rows: [
            { $id: "i1", order: { $id: "o1" } },
            { $id: "i2", order: { $id: "o1" } },
            { $id: "i3", order: { $id: "o2" } },
          ],
          total: 3,
        };
      }
      return { rows: [{ $id: "o1" }], total: 2 };
    });

    const result = await listOrders({
      page: 1,
      size: 25,
      q: "",
      productId: "prod-1",
    });

    expect(result.truncated).toBe(false);
    const itemQueries = onlyQueriesFor(sessionDb, "order_items");
    expect(itemQueries).toContain(Query.equal("product.$id", "prod-1"));

    const queries = onlyQueriesFor(sessionDb, "orders");
    expect(queries).toContain(Query.equal("$id", ["o1", "o2"]));
    expect(queries).toContain(ORDER_SCOPE);
    // A nested FILTER on order_items would silently truncate at 500; the
    // nested paths in the projection are fine.
    const nestedFilters = queries.filter(
      (query) =>
        query.includes("order_items.") && !query.includes('"method":"select"')
    );
    expect(nestedFilters).toEqual([]);
  });

  test("short-circuits when a product matches no orders", async () => {
    sessionDb.listRows.mockImplementation(() => ({ rows: [], total: 0 }));

    const result = await listOrders({
      page: 1,
      size: 25,
      q: "",
      productId: "prod-none",
    });

    expect(result).toEqual({
      rows: [],
      total: 0,
      page: 1,
      size: 25,
      truncated: false,
    });
    expect(queriesFor(sessionDb, "orders")).toHaveLength(0);
  });

  test("flags a truncated product filter", async () => {
    const items = Array.from({ length: 500 }, (_, index) => ({
      $id: `i${index}`,
      order: { $id: `o${index}` },
    }));
    sessionDb.listRows.mockImplementation((_db: string, tableId: string) => {
      if (tableId === "order_items") {
        return { rows: items, total: 900 };
      }
      return { rows: [], total: 500 };
    });

    const result = await listOrders({
      page: 1,
      size: 25,
      q: "",
      productId: "prod-big",
    });

    expect(result.truncated).toBe(true);
  });
});

describe("listOrderIdsForProduct", () => {
  test("cursor-pages order_items and returns distinct parent order ids", async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      $id: `i${index}`,
      order: { $id: `o${index % 250}` },
    }));
    sessionDb.listRows.mockImplementationOnce(() => ({
      rows: firstPage,
      total: 502,
    }));
    sessionDb.listRows.mockImplementationOnce(() => ({
      rows: [
        { $id: "i500", order: { $id: "o250" } },
        { $id: "i501", order: { $id: "o0" } },
      ],
      total: 502,
    }));

    const result = await listOrderIdsForProduct("prod-1");

    expect(result.truncated).toBe(false);
    expect(result.ids).toHaveLength(251);
    const calls = queriesFor(sessionDb, "order_items");
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain(Query.select(["$id", "order.$id"]));
    expect(calls[1]).toContain(Query.cursorAfter("i499"));
  });

  test("honours a caller-supplied limit and reports truncation", async () => {
    sessionDb.listRows.mockImplementation(() => ({
      rows: [
        { $id: "i1", order: { $id: "o1" } },
        { $id: "i2", order: { $id: "o2" } },
        { $id: "i3", order: { $id: "o3" } },
      ],
      total: 3,
    }));

    const result = await listOrderIdsForProduct("prod-1", { limit: 2 });

    expect(result.ids).toEqual(["o1", "o2"]);
    expect(result.truncated).toBe(true);
  });

  test("reads a plain relationship id when Appwrite returns one", async () => {
    sessionDb.listRows.mockImplementation(() => ({
      rows: [{ $id: "i1", order: "o1" }],
      total: 1,
    }));

    const result = await listOrderIdsForProduct("prod-1");

    expect(result.ids).toEqual(["o1"]);
  });
});

describe("countOrderStats", () => {
  test("tallies revenue and status counts under the same scope and filters", async () => {
    sessionDb.listRows.mockImplementation(() => ({
      rows: [
        { $id: "o1", status: "paid", total: 100 },
        { $id: "o2", status: "paid", total: 250 },
        { $id: "o3", status: "pending", total: 50 },
        { $id: "o4", status: "refunded", total: 75 },
        { $id: "o5", status: "cancelled", total: 10 },
        { $id: "o6", status: "failed", total: 10 },
        { $id: "o7", status: "authorized", total: 30 },
      ],
      total: 7,
    }));

    const stats = await countOrderStats({ status: "all", q: "andreas" });

    expect(stats).toEqual({
      all: 7,
      authorized: 1,
      cancelled: 1,
      capped: false,
      failed: 1,
      paid: 2,
      paidRevenue: 350,
      pending: 1,
      refunded: 1,
    });
    // `pendingCount` duplicated `pending`; the UI reads `pending`.
    expect("pendingCount" in stats).toBe(false);

    const queries = onlyQueriesFor(sessionDb, "orders");
    expect(queries).toContain(Query.select(["$id", "status", "total"]));
    expect(queries).toContain(ORDER_SCOPE);
    expect(queries.some((query) => query.includes('"or"'))).toBe(true);
  });

  test("flags a capped total so the UI can render 5000+", async () => {
    sessionDb.listRows.mockImplementation(() => ({
      rows: [{ $id: "o1", status: "paid", total: 100 }],
      total: 5000,
    }));

    const stats = await countOrderStats({});

    expect(stats.all).toBe(5000);
    expect(stats.capped).toBe(true);
  });

  test("returns zeroes when a product filter matches no orders", async () => {
    sessionDb.listRows.mockImplementation(() => ({ rows: [], total: 0 }));

    const stats = await countOrderStats({ productId: "prod-none" });

    expect(stats.all).toBe(0);
    expect(stats.paidRevenue).toBe(0);
    expect(stats.authorized).toBe(0);
    expect(stats.failed).toBe(0);
    expect(queriesFor(sessionDb, "orders")).toHaveLength(0);
  });

  test("keeps the scope under every filter combination", async () => {
    sessionDb.listRows.mockImplementation((_db: string, tableId: string) =>
      tableId === "order_items"
        ? { rows: [{ $id: "i1", order: { $id: "o1" } }], total: 1 }
        : { rows: [{ $id: "o1", status: "paid", total: 10 }], total: 1 }
    );

    await countOrderStats({
      from: "2026-01-01",
      productId: "prod-1",
      q: "andreas",
      to: "2026-01-31",
    });

    const queries = onlyQueriesFor(sessionDb, "orders");
    expect(queries).toContain(ORDER_SCOPE);
    expect(queries).toContain(Query.equal("$id", ["o1"]));
    expect(queries).toContain(
      Query.between(
        "$createdAt",
        "2026-01-01T00:00:00.000Z",
        "2026-01-31T23:59:59.999Z"
      )
    );
    expect(queries.some((query) => query.includes('"or"'))).toBe(true);
  });
});

describe("listOrderProductOptions", () => {
  test("lists scoped catalog products with their translated titles", async () => {
    adminDb.listRows.mockImplementation((_db: string, tableId: string) => {
      if (tableId === "webshop_products") {
        return {
          rows: [
            { $id: "p1", slug: "genser" },
            { $id: "p2", slug: "booklocker-oslo" },
          ],
          total: 2,
        };
      }
      return {
        rows: [
          { $id: "t1", content_id: "p1", locale: "no", title: "Genser" },
          { $id: "t2", content_id: "p1", locale: "en", title: "Sweater" },
        ],
        total: 2,
      };
    });

    const options = await listOrderProductOptions();

    expect(options).toEqual([
      { id: "p2", name: "booklocker-oslo" },
      { id: "p1", name: "Genser" },
    ]);
    const queries = onlyQueriesFor(adminDb, "webshop_products");
    expect(queries).toContain(PRODUCT_SCOPE);
  });
});

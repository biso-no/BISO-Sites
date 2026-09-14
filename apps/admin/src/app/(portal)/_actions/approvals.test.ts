import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";

const db = {
  createRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
};

// The approver's own session. Kept distinct from the admin client so a test
// can prove which reads go through which: `sales_types` is readable only by
// the operations unit, so a campus admin's session read of it is refused.
const sessionDb = {
  createRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
};

const baseCtx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: ["Oslo"],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: "admin@example.com",
  managedCampuses: ["Oslo"],
  managedCampusIds: ["campus-oslo"],
  name: "Admin",
  resolvedCampusIds: ["campus-oslo"],
  resolvedDepartmentIds: [],
  roles: ["campusadmin"],
  userId: "user-1",
};

let currentCtx: UserAuthContext = baseCtx;

// `approvals.ts` transitively imports `./events` -> `@/lib/announcements/send`,
// which starts with `import "server-only"`. Next.js aliases that package away
// via the `react-server` export condition when bundling; plain `bun test`
// doesn't set that condition, so the marker package throws on import unless
// it's neutralized here (same pattern as `packages/api/page-builder.test.ts`).
mock.module("server-only", () => ({}));

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db: sessionDb })),
}));

mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));

mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));

const { approveRequest, listPendingApprovals } = await import("./approvals");

describe("listPendingApprovals", () => {
  beforeEach(() => {
    currentCtx = baseCtx;
    sessionDb.listRows.mockReset();
  });

  test("reports the true total and paginates", async () => {
    sessionDb.listRows.mockResolvedValueOnce({
      rows: [{ $id: "r1" }],
      total: 133,
    });

    const result = await listPendingApprovals({ page: 2, size: 25, q: "" });

    expect("data" in result).toBe(true);
    if (!("data" in result)) {
      throw new Error("expected data");
    }
    expect(result.data.total).toBe(133);
    const queries = sessionDb.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.offset(25));
  });

  test("keeps the campus switcher filter on every page", async () => {
    currentCtx = { ...baseCtx, activeCampusId: "campus-bergen" };
    sessionDb.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listPendingApprovals({ page: 3, size: 25, q: "" });

    const queries = sessionDb.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.equal("campus_id", ["campus-bergen"]));
  });

  test("degrades to an empty page when the table is missing", async () => {
    sessionDb.listRows.mockRejectedValueOnce(new Error("table not found"));

    const result = await listPendingApprovals({ page: 1, size: 25, q: "" });

    expect(result).toEqual({
      data: { rows: [], total: 0, page: 1, size: 25 },
    });
  });
});

describe("approveRequest: shop products must be bookable", () => {
  const approvalRequest = {
    $id: "req-1",
    action: "shop.publish",
    payload: "{}",
    resource_id: "product-1",
    status: "pending" as const,
  };

  const bookableProduct = {
    $id: "product-1",
    campus_id: "campus-oslo",
    departmentId: "1",
    sales_type: "sales-type-1",
    status: "pending_approval",
  };

  function sessionReadRefused(table: string): Error {
    return Object.assign(
      new Error(`The current user is not authorized to read ${table}`),
      { code: 401, type: "user_unauthorized" }
    );
  }

  function rowNotFound(): Error {
    return Object.assign(new Error("Row with the requested ID not found."), {
      code: 404,
      type: "row_not_found",
    });
  }

  function mockRows({
    product = bookableProduct,
    salesType,
  }: {
    product?: Record<string, unknown>;
    salesType: { $id: string; active: boolean } | null;
  }) {
    // The approver's session can read the request and the product, but not
    // the sales types (no row security; table read is operations-unit only).
    sessionDb.getRow.mockImplementation(
      (_databaseId: string, table: string) => {
        if (table === "approval_requests") {
          return Promise.resolve(approvalRequest);
        }
        if (table === "webshop_products") {
          return Promise.resolve(product);
        }
        return Promise.reject(sessionReadRefused(table));
      }
    );
    db.getRow.mockImplementation((_databaseId: string, table: string) => {
      if (table === "sales_types") {
        return salesType
          ? Promise.resolve(salesType)
          : Promise.reject(rowNotFound());
      }
      return Promise.reject(new Error(`unexpected admin getRow(${table})`));
    });
  }

  function expectNothingWritten() {
    expect(sessionDb.updateRow).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
  }

  beforeEach(() => {
    currentCtx = baseCtx;
    for (const client of [db, sessionDb]) {
      client.getRow.mockReset();
      client.updateRow.mockReset();
      client.createRow.mockReset();
    }
  });

  test("refuses to publish when the sales type is inactive", async () => {
    mockRows({ salesType: { $id: "sales-type-1", active: false } });

    const result = await approveRequest("req-1");

    expect(result).toEqual({
      error: "Choose an active sales type before publishing",
    });
    // Neither the product nor the approval request should have been touched.
    expectNothingWritten();
  });

  test("refuses to publish when the sales type no longer exists", async () => {
    mockRows({ salesType: null });

    const result = await approveRequest("req-1");

    expect(result).toEqual({
      error: "Choose an active sales type before publishing",
    });
    expectNothingWritten();
  });

  test("refuses to publish a product without a department", async () => {
    mockRows({
      product: { ...bookableProduct, departmentId: null },
      salesType: { $id: "sales-type-1", active: true },
    });

    const result = await approveRequest("req-1");

    expect(result).toEqual({ error: "Choose a department before publishing" });
    expectNothingWritten();
  });

  test("reads the sales type with the admin client, which a campus admin's session cannot", async () => {
    mockRows({ salesType: { $id: "sales-type-1", active: true } });

    const result = await approveRequest("req-1");

    expect(result).toEqual({ data: "req-1" });
    expect(db.getRow).toHaveBeenCalledWith(
      "app",
      "sales_types",
      "sales-type-1"
    );
    expect(sessionDb.getRow).not.toHaveBeenCalledWith(
      "app",
      "sales_types",
      expect.anything()
    );
  });

  test("publishes when the sales type is active", async () => {
    mockRows({ salesType: { $id: "sales-type-1", active: true } });

    const result = await approveRequest("req-1");

    expect(result).toEqual({ data: "req-1" });
    expect(sessionDb.updateRow).toHaveBeenCalledWith(
      "app",
      "webshop_products",
      "product-1",
      { status: "published" }
    );
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "approval_requests",
      "req-1",
      expect.objectContaining({ status: "approved" })
    );
  });
});

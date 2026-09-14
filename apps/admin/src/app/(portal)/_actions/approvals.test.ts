import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";

const db = {
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
  createSessionClient: mock(async () => ({ db })),
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
    db.listRows.mockReset();
  });

  test("reports the true total and paginates", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [{ $id: "r1" }], total: 133 });

    const result = await listPendingApprovals({ page: 2, size: 25, q: "" });

    expect("data" in result).toBe(true);
    if (!("data" in result)) {
      throw new Error("expected data");
    }
    expect(result.data.total).toBe(133);
    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.offset(25));
  });

  test("keeps the campus switcher filter on every page", async () => {
    currentCtx = { ...baseCtx, activeCampusId: "campus-bergen" };
    db.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listPendingApprovals({ page: 3, size: 25, q: "" });

    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.equal("campus_id", ["campus-bergen"]));
  });

  test("degrades to an empty page when the table is missing", async () => {
    db.listRows.mockRejectedValueOnce(new Error("table not found"));

    const result = await listPendingApprovals({ page: 1, size: 25, q: "" });

    expect(result).toEqual({
      data: { rows: [], total: 0, page: 1, size: 25 },
    });
  });
});

describe("approveRequest: shop products require an active sales type", () => {
  const approvalRequest = {
    $id: "req-1",
    action: "shop.publish",
    payload: "{}",
    resource_id: "product-1",
    status: "pending" as const,
  };

  function mockRows({
    salesType,
  }: {
    salesType: { $id: string; active: boolean } | null;
  }) {
    db.getRow.mockImplementation((_databaseId: string, table: string) => {
      if (table === "approval_requests") {
        return Promise.resolve(approvalRequest);
      }
      if (table === "webshop_products") {
        return Promise.resolve({
          $id: "product-1",
          campus_id: "campus-oslo",
          sales_type: "sales-type-1",
          status: "pending_approval",
        });
      }
      if (table === "sales_types") {
        return Promise.resolve(salesType);
      }
      return Promise.reject(new Error(`unexpected getRow(${table})`));
    });
  }

  beforeEach(() => {
    currentCtx = baseCtx;
    db.getRow.mockReset();
    db.updateRow.mockReset();
    db.createRow.mockReset();
  });

  test("refuses to publish when the sales type is inactive", async () => {
    mockRows({ salesType: { $id: "sales-type-1", active: false } });

    const result = await approveRequest("req-1");

    expect(result).toEqual({
      error: "Choose an active sales type before publishing",
    });
    // Neither the product nor the approval request should have been touched.
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("refuses to publish when the sales type no longer exists", async () => {
    mockRows({ salesType: null });

    const result = await approveRequest("req-1");

    expect(result).toEqual({
      error: "Choose an active sales type before publishing",
    });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("publishes when the sales type is active", async () => {
    mockRows({ salesType: { $id: "sales-type-1", active: true } });

    const result = await approveRequest("req-1");

    expect(result).toEqual({ data: "req-1" });
    expect(db.updateRow).toHaveBeenCalledWith(
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

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";

const db = { listRows: mock() };

const globalAdminCtx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: ["Oslo"],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: "admin@example.com",
  managedCampuses: [],
  managedCampusIds: [],
  name: "Global Admin",
  resolvedCampusIds: [],
  resolvedDepartmentIds: [],
  roles: ["globaladmin"],
  userId: "user-1",
};

let currentCtx: UserAuthContext = globalAdminCtx;

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
}));

mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));

const { listActivityLog } = await import("./activity");

describe("listActivityLog", () => {
  beforeEach(() => {
    currentCtx = globalAdminCtx;
    db.listRows.mockReset();
  });

  test("returns Appwrite's true total, not the page length", async () => {
    db.listRows.mockResolvedValueOnce({
      rows: [{ $id: "a" }, { $id: "b" }],
      total: 4021,
    });

    const result = await listActivityLog({ page: 1, size: 25, q: "" });

    expect(result.total).toBe(4021);
    expect(result.rows).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.size).toBe(25);
  });

  test("offsets by (page - 1) * size", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [], total: 4021 });

    await listActivityLog({ page: 3, size: 50, q: "" });

    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.limit(50));
    expect(queries).toContain(Query.offset(100));
  });

  test("denies a non-admin without querying Appwrite", async () => {
    currentCtx = { ...globalAdminCtx, roles: ["department"] };

    const result = await listActivityLog({ page: 1, size: 25, q: "" });

    expect(result).toEqual({ rows: [], total: 0, page: 1, size: 25 });
    expect(db.listRows).not.toHaveBeenCalled();
  });
});

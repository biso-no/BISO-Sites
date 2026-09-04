import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";

const db = { listRows: mock() };

const globalAdminCtx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: [],
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

const { listVarslingSettings } = await import("./varsling");

describe("listVarslingSettings", () => {
  beforeEach(() => {
    currentCtx = globalAdminCtx;
    db.listRows.mockReset();
  });

  test("returns the true total and the requested slice", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [{ $id: "v1" }], total: 87 });

    const result = await listVarslingSettings({ page: 2, size: 25, q: "" });

    expect(result.total).toBe(87);
    expect(result.page).toBe(2);
    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.offset(25));
  });

  test("returns an empty page for an unauthorized user", async () => {
    currentCtx = {
      ...globalAdminCtx,
      departmentTeamIds: [],
      roles: ["campusadmin"],
    };

    const result = await listVarslingSettings({ page: 1, size: 25, q: "" });

    expect(result).toEqual({ rows: [], total: 0, page: 1, size: 25 });
    expect(db.listRows).not.toHaveBeenCalled();
  });
});

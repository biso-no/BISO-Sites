import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";

const db = { listRows: mock() };

const campusAdminCtx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: ["Oslo"],
  campusTeamIds: ["sg-app-campus-oslo"],
  departmentNames: [],
  departmentTeamIds: [],
  email: "admin@example.com",
  managedCampuses: ["Oslo"],
  managedCampusIds: ["campus-oslo"],
  name: "Oslo Admin",
  resolvedCampusIds: ["campus-oslo"],
  resolvedDepartmentIds: [],
  roles: ["campusadmin"],
  userId: "user-1",
};

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));

mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => campusAdminCtx),
}));

const { listBenefits } = await import("./benefits");

describe("listBenefits pagination", () => {
  beforeEach(() => {
    db.listRows.mockReset();
  });

  test("reports the true total and offsets correctly", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [{ $id: "b1" }], total: 240 });

    const result = await listBenefits({ page: 4, size: 50, q: "" });

    expect(result.total).toBe(240);
    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.limit(50));
    expect(queries).toContain(Query.offset(150));
  });

  test("searches the row title columns, not a translations table", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listBenefits({ page: 1, size: 25, q: "rabatt" });

    expect(db.listRows).toHaveBeenCalledTimes(1);
    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(
      Query.or([
        Query.contains("title_nb", "rabatt"),
        Query.contains("title_en", "rabatt"),
      ])
    );
  });

  test("adds no search query when q is empty", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listBenefits({ page: 1, size: 25, q: "" });

    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries.some((query) => query.includes("contains"))).toBe(false);
  });
});

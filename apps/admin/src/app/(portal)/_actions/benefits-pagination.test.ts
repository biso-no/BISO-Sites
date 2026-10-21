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
  managedCampusIds: ["2"],
  name: "Oslo Admin",
  resolvedCampusIds: ["2"],
  resolvedDepartmentIds: [],
  roles: ["campusadmin"],
  userId: "user-1",
};

const departmentOnlyCtx: UserAuthContext = {
  ...campusAdminCtx,
  managedCampuses: [],
  managedCampusIds: [],
  roles: ["department"],
};

let currentCtx: UserAuthContext = campusAdminCtx;

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));

mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));

const { listBenefits } = await import("./benefits");

describe("listBenefits pagination", () => {
  beforeEach(() => {
    currentCtx = campusAdminCtx;
    db.listRows.mockReset();
  });

  test("scopes a campus admin to their campus and Hele BISO", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listBenefits({ page: 1, size: 25, q: "" });

    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.equal("campus_id", ["2", "5"]));
  });

  test("matches nothing for a user without benefit access", async () => {
    currentCtx = departmentOnlyCtx;
    db.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listBenefits({ page: 1, size: 25, q: "" });

    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries.some((query) => query.includes('"campus_id"'))).toBe(false);
    expect(queries).toContain(Query.equal("$id", "__no_benefit_access__"));
  });

  test("never returns a code", async () => {
    db.listRows.mockResolvedValueOnce({
      rows: [
        { $id: "b1", campus_id: "2", redemption_value: "BISO20" },
        { $id: "b2", campus_id: "5", redemption_value: null },
      ],
      total: 2,
    });

    const result = await listBenefits({ page: 1, size: 25, q: "" });

    expect(result.rows.map((row) => row.$id)).toEqual(["b1", "b2"]);
    for (const row of result.rows) {
      expect(row.redemption_value ?? null).toBeNull();
    }
  });

  test("filters by status", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listBenefits({ page: 1, q: "", size: 25, status: "draft" });

    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.equal("status", "draft"));
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

const { listPartners } = await import("./benefits");

describe("listPartners pagination", () => {
  beforeEach(() => {
    currentCtx = campusAdminCtx;
    db.listRows.mockReset();
  });

  test("reports the true total and offsets correctly", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [{ $id: "p1" }], total: 312 });

    const result = await listPartners({ page: 2, size: 100, q: "" });

    expect(result.total).toBe(312);
    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.limit(100));
    expect(queries).toContain(Query.offset(100));
  });

  test("searches the indexed name column", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listPartners({ page: 1, size: 25, q: "sats" });

    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.contains("name", "sats"));
  });

  test("keeps campus scoping for a non-global admin on a deep page", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [], total: 0 });

    await listPartners({ page: 5, size: 25, q: "" });

    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.equal("campus_id", ["2"]));
    expect(queries).toContain(Query.offset(100));
  });
});

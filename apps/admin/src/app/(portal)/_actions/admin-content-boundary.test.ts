import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";

const adminDb = {
  createRow: mock(),
  deleteRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
  upsertRow: mock(),
};
const sessionDb = {
  listRows: mock(),
};

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

const departmentCtx = makeCtx({
  campusNames: ["Oslo"],
  departmentNames: ["Sosialutvalget"],
  departmentTeamIds: ["sg-app-dept-sosialutvalget"],
  resolvedCampusIds: ["campus-oslo"],
  resolvedDepartmentIds: ["dept-1"],
});
const campusAdminCtx = makeCtx({
  campusNames: ["Oslo"],
  campusTeamIds: ["sg-app-campus-oslo"],
  managedCampuses: ["Oslo"],
  managedCampusIds: ["campus-oslo"],
  resolvedCampusIds: ["campus-oslo"],
  roles: ["campusadmin"],
});

let currentCtx: UserAuthContext = departmentCtx;

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: adminDb })),
  createSessionClient: mock(async () => ({ db: sessionDb })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { listDrafts } = await import("./drafts");
const { searchEverything } = await import("./palette-search");
const { listDepartmentsForCampus } = await import("./lookups");

beforeEach(() => {
  currentCtx = departmentCtx;
  adminDb.createRow.mockReset();
  adminDb.deleteRow.mockReset();
  adminDb.getRow.mockReset();
  adminDb.listRows.mockReset();
  adminDb.updateRow.mockReset();
  adminDb.upsertRow.mockReset();
  sessionDb.listRows.mockReset();

  adminDb.listRows.mockResolvedValue({ rows: [], total: 0 });
  sessionDb.listRows.mockResolvedValue({ rows: [], total: 0 });
});

describe("draft discovery boundary", () => {
  test("department drafts are scoped by ownership relationships on the admin client", async () => {
    await listDrafts();

    const newsCall = adminDb.listRows.mock.calls.find(
      (call) => call[1] === "news"
    );
    expect(newsCall?.[2]).toEqual(
      expect.arrayContaining([
        Query.equal("campus.$id", ["campus-oslo"]),
        Query.equal("department.$id", ["dept-1"]),
      ])
    );
    const eventsCall = adminDb.listRows.mock.calls.find(
      (call) => call[1] === "events"
    );
    expect(eventsCall?.[2]).toEqual(
      expect.arrayContaining([Query.equal("department.$id", ["dept-1"])])
    );
    expect(sessionDb.listRows).not.toHaveBeenCalled();
  });

  test("jobs stay on the scalar scope so legacy vacancies remain visible", async () => {
    await listDrafts();

    // Recruitment is outside the relationship-canonical content set, and the
    // ownership repair leaves job relations to the recruitment rollout, so a
    // relationship filter here would hide every pre-relationship vacancy.
    const jobsCall = adminDb.listRows.mock.calls.find(
      (call) => call[1] === "jobs"
    );
    expect(jobsCall?.[2]).toEqual(
      expect.arrayContaining([
        Query.equal("campus_id", ["campus-oslo"]),
        Query.equal("department_id", ["dept-1"]),
      ])
    );
  });
});

describe("palette search boundary", () => {
  test("department search uses relationship scope and skips jobs and orders", async () => {
    await searchEverything("student");

    const searchedTables = adminDb.listRows.mock.calls.map((call) => call[1]);
    expect(searchedTables).toContain("news");
    expect(searchedTables).toContain("events");
    expect(searchedTables).toContain("webshop_products");
    // Jobs stay HR/global-only; orders are an operational commerce surface.
    expect(searchedTables).not.toContain("jobs");
    expect(searchedTables).not.toContain("orders");

    const newsCall = adminDb.listRows.mock.calls.find(
      (call) => call[1] === "news"
    );
    expect(newsCall?.[2]).toEqual(
      expect.arrayContaining([
        Query.equal("campus.$id", ["campus-oslo"]),
        Query.equal("department.$id", ["dept-1"]),
      ])
    );
    expect(sessionDb.listRows).not.toHaveBeenCalled();
  });

  test("campus admins still search orders but not jobs", async () => {
    currentCtx = campusAdminCtx;

    await searchEverything("student");

    const searchedTables = adminDb.listRows.mock.calls.map((call) => call[1]);
    expect(searchedTables).toContain("orders");
    expect(searchedTables).not.toContain("jobs");
  });

  test("HR members search jobs scoped to their campuses", async () => {
    currentCtx = makeCtx({
      campusNames: ["Oslo"],
      departmentNames: ["HR"],
      departmentTeamIds: ["sg-app-dept-hr"],
      resolvedCampusIds: ["campus-oslo"],
      resolvedDepartmentIds: ["dept-hr"],
      roles: ["hr"],
    });

    await searchEverything("student");

    const jobsCall = adminDb.listRows.mock.calls.find(
      (call) => call[1] === "jobs"
    );
    expect(jobsCall?.[2]).toEqual(
      expect.arrayContaining([Query.equal("campus.$id", ["campus-oslo"])])
    );
  });
});

describe("department lookup boundary", () => {
  test("department authors only see their own departments", async () => {
    adminDb.listRows.mockResolvedValue({
      rows: [
        { $id: "dept-1", Name: "Sosialutvalget" },
        { $id: "dept-2", Name: "Fadderuka" },
      ],
      total: 2,
    });

    const rows = await listDepartmentsForCampus("campus-oslo");

    expect(rows.map((row) => row.$id)).toEqual(["dept-1"]);
  });

  test("campus admins see every department in the campus", async () => {
    currentCtx = campusAdminCtx;
    adminDb.listRows.mockResolvedValue({
      rows: [
        { $id: "dept-1", Name: "Sosialutvalget" },
        { $id: "dept-2", Name: "Fadderuka" },
      ],
      total: 2,
    });

    const rows = await listDepartmentsForCampus("campus-oslo");

    expect(rows).toHaveLength(2);
  });
});

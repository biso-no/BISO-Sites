import { describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "./authorization";
import { pageAccessContext } from "./page-access";
import { assertWriteAccess, hasRowAccess } from "./utils/authorization";

const member = (overrides: Partial<UserAuthContext> = {}): UserAuthContext => ({
  campusNames: ["Oslo"],
  campusTeamIds: ["sg-app-campus-oslo"],
  departmentNames: ["Wintergames", "OSL Other"],
  departmentTeamIds: ["sg-app-dept-wintergames", "sg-app-dept-other"],
  email: null,
  managedCampusIds: [],
  managedCampuses: [],
  name: null,
  resolvedCampusIds: ["1"],
  resolvedDepartmentIds: ["dept-w", "dept-x"],
  roles: [],
  userId: "user-1",
  ...overrides,
});

const DEPARTMENTS: Record<string, Record<string, unknown>> = {
  "dept-w": { $id: "dept-w", campus: { $id: "5" }, campus_id: "5" },
  "dept-x": { $id: "dept-x", campus: "1", campus_id: "1" },
  // A row from before the relationship backfill.
  "dept-legacy": { $id: "dept-legacy", campus: null, campus_id: "3" },
};

const db = {
  getRow: mock((_db: string, _table: string, id: string) => {
    const row = DEPARTMENTS[id];
    if (!row) {
      return Promise.reject(new Error("Row not found"));
    }
    return Promise.resolve(row);
  }),
};

describe("pageAccessContext", () => {
  test("adds the bound department's own campus for its member", async () => {
    const ctx = await pageAccessContext(db as never, member(), "5", "dept-w");
    expect(ctx.resolvedCampusIds).toEqual(["1", "5"]);
    expect(hasRowAccess(ctx, "5", "dept-w")).toBe(true);
  });

  test("adds only the department's own campus, never another", async () => {
    db.getRow.mockClear();
    // Campus 2 is no campus of theirs and not Wintergames' either.
    const other = await pageAccessContext(db as never, member(), "2", "dept-w");
    expect(other.resolvedCampusIds).toEqual(["1"]);
    expect(hasRowAccess(other, "2", "dept-w")).toBe(false);
    // Campus 5 is Wintergames', not the Oslo department's.
    const oslo = await pageAccessContext(db as never, member(), "5", "dept-x");
    expect(oslo.resolvedCampusIds).toEqual(["1"]);
    expect(hasRowAccess(oslo, "5", "dept-x")).toBe(false);
    expect(db.getRow).toHaveBeenCalledTimes(2);
  });

  test("reads the campus from the department row, legacy column as fallback", async () => {
    const ctx = await pageAccessContext(
      db as never,
      member({ resolvedDepartmentIds: ["dept-legacy"] }),
      "3",
      "dept-legacy"
    );
    expect(ctx.resolvedCampusIds).toEqual(["1", "3"]);
  });

  test("leaves everyone else as they are, without a read", async () => {
    db.getRow.mockClear();
    const cases: [UserAuthContext, string | null, string | null][] = [
      // Not a member of the page's department.
      [member({ resolvedDepartmentIds: ["dept-x"] }), "5", "dept-w"],
      // A page bound to no department, or on no campus.
      [member(), "5", null],
      [member(), null, "dept-w"],
      // The campus is already theirs.
      [member(), "1", "dept-x"],
      // A campus admin's managed campuses are their whole reach.
      [
        member({ managedCampusIds: ["1"], roles: ["campusadmin"] }),
        "5",
        "dept-w",
      ],
      // A global admin needs nothing.
      [member({ roles: ["globaladmin"] }), "5", "dept-w"],
    ];
    for (const [ctx, campusId, departmentId] of cases) {
      expect(
        await pageAccessContext(db as never, ctx, campusId, departmentId)
      ).toBe(ctx);
    }
    expect(db.getRow).not.toHaveBeenCalled();
  });

  test("a failed department read changes nothing", async () => {
    const ctx = member({ resolvedDepartmentIds: ["dept-gone"] });
    expect(await pageAccessContext(db as never, ctx, "5", "dept-gone")).toBe(
      ctx
    );
  });

  test("the shared checks themselves are unchanged", () => {
    // What every other content type and list still sees for the same member.
    expect(hasRowAccess(member(), "5", "dept-w")).toBe(false);
    expect(() => assertWriteAccess(member(), "5", "dept-w")).toThrow(
      "no access to this campus"
    );
  });
});

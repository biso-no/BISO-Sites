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
  "dept-w": {
    $id: "dept-w",
    campus: { $id: "5" },
    campus_id: "5",
    Name: "Wintergames",
  },
  "dept-x": { $id: "dept-x", campus: "1", campus_id: "1", Name: "OSL Other" },
  // A row from before the relationship backfill.
  "dept-legacy": {
    $id: "dept-legacy",
    campus: null,
    campus_id: "3",
    Name: "TRD Legacy",
  },
  // Two rows sharing one Name: a team named "Shared" resolves to both.
  "dept-shared-5": {
    $id: "dept-shared-5",
    campus: "5",
    campus_id: "5",
    Name: "Shared",
  },
  "dept-shared-2": {
    $id: "dept-shared-2",
    campus: "2",
    campus_id: "2",
    Name: "Shared",
  },
};

/** The `values` of the `equal` query on `Name`, as `Query.equal` encodes it. */
const nameFilter = (queries: string[] = []): unknown[] => {
  for (const query of queries) {
    const parsed = JSON.parse(query) as {
      attribute?: string;
      method?: string;
      values?: unknown[];
    };
    if (parsed.method === "equal" && parsed.attribute === "Name") {
      return parsed.values ?? [];
    }
  }
  return [];
};

const db = {
  getRow: mock((_db: string, _table: string, id: string) => {
    const row = DEPARTMENTS[id];
    if (!row) {
      return Promise.reject(new Error("Row not found"));
    }
    return Promise.resolve(row);
  }),
  listRows: mock((_db: string, _table: string, queries?: string[]) => {
    const names = nameFilter(queries);
    const rows = Object.values(DEPARTMENTS).filter((row) =>
      names.includes(row.Name)
    );
    return Promise.resolve({ rows, total: rows.length });
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

  // Membership comes from team name == `departments.Name`, and Name is not
  // unique: a member of "Shared" resolves to both rows, so neither campus
  // can be said to be their department's.
  test("a name shared by two departments on different campuses gives no grant", async () => {
    const ctx = member({
      departmentNames: ["Shared"],
      resolvedDepartmentIds: ["dept-shared-5", "dept-shared-2"],
    });
    for (const [campusId, departmentId] of [
      ["5", "dept-shared-5"],
      ["2", "dept-shared-2"],
    ] as const) {
      const pageCtx = await pageAccessContext(
        db as never,
        ctx,
        campusId,
        departmentId
      );
      expect(pageCtx).toBe(ctx);
      expect(hasRowAccess(pageCtx, campusId, departmentId)).toBe(false);
    }
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

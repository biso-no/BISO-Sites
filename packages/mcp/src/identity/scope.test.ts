/**
 * Scope engine tests.
 *
 * These restate the cases `apps/admin/src/lib/authorization.test.ts` covers for
 * `applyScopeQueries` / `assertWriteAccess`, so a divergence between this port
 * and the original fails here rather than silently widening what the MCP server
 * can read.
 *
 * The fail-closed cases matter most: every one of them is a case where the
 * wrong answer is "return every row in every campus" rather than "throw".
 */

import { describe, expect, test } from "bun:test";
import {
  ANONYMOUS,
  CAMPUS_ADMIN,
  DEPARTMENT_MEMBER,
  GLOBAL_ADMIN,
  makePrincipal,
} from "../testing/index";
import {
  assertPublishAccess,
  assertWriteAccess,
  canPublish,
  canReadRow,
  describeScope,
  relationId,
  rowOwnership,
  scopeQueries,
} from "./scope";

const DO_NOT_MANAGE_I_RE = /do not manage/i;
const NO_WRITE_ACCESS_TO_THIS_DEPARTMENT_I_RE =
  /no write access to this department/i;
const NO_ACCESS_TO_BERGEN_CAMPUS_I_RE = /no access to Bergen \(campus 2\)/i;
const VERIFIED_IDENTITY_I_RE = /verified identity/i;
const NO_ROWS_I_RE = /no rows/i;

const NO_MATCH = "__no_scope_resolved__";

function containsNoMatch(queries: string[]): boolean {
  return queries.some((query) => query.includes(NO_MATCH));
}

describe("scopeQueries", () => {
  test("a global admin is unrestricted", () => {
    expect(scopeQueries(GLOBAL_ADMIN())).toEqual([]);
  });

  test("a campus admin is restricted to managed campuses", () => {
    const queries = scopeQueries(CAMPUS_ADMIN("Oslo", "1"));
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain("campus_id");
    expect(queries[0]).toContain("1");
  });

  test("a department member is restricted to campus AND department", () => {
    const queries = scopeQueries(DEPARTMENT_MEMBER("dept-esn-oslo", "1"));
    expect(queries).toHaveLength(2);
    expect(queries.join(" ")).toContain("campus_id");
    expect(queries.join(" ")).toContain("department_id");
    expect(queries.join(" ")).toContain("dept-esn-oslo");
  });

  test("a department member on a table with no department column sees nothing", () => {
    // The dangerous alternative is showing them the whole campus.
    const queries = scopeQueries(DEPARTMENT_MEMBER(), {
      departmentField: null,
    });
    expect(containsNoMatch(queries)).toBe(true);
  });

  test("team-level department membership that resolved to no ids fails closed", () => {
    const principal = makePrincipal({
      departmentTeamIds: ["sg-app-dept-something"],
      departmentNames: ["Something"],
      resolvedDepartmentIds: [],
      resolvedCampusIds: ["1"],
    });
    expect(containsNoMatch(scopeQueries(principal))).toBe(true);
  });

  test("a principal with no scope at all fails closed", () => {
    expect(containsNoMatch(scopeQueries(makePrincipal()))).toBe(true);
  });

  test("campus team membership alone grants nothing", () => {
    // Being on the Oslo campus team without a department or a management team
    // is not access.
    const principal = makePrincipal({
      campusNames: ["Oslo"],
      campusTeamIds: ["sg-app-campus-oslo"],
      resolvedCampusIds: ["1"],
    });
    expect(containsNoMatch(scopeQueries(principal))).toBe(true);
  });

  test("a campus admin on a table with no campus column is not narrowed", () => {
    expect(scopeQueries(CAMPUS_ADMIN(), { campusField: null })).toEqual([]);
  });

  test("relationship paths are used when configured", () => {
    const queries = scopeQueries(CAMPUS_ADMIN("Bergen", "2"), {
      campusField: "campus.$id",
      departmentField: "department.$id",
    });
    expect(queries[0]).toContain("campus.$id");
  });
});

describe("assertWriteAccess", () => {
  test("a global admin may write anywhere", () => {
    expect(() =>
      assertWriteAccess(GLOBAL_ADMIN(), "3", "dept-x")
    ).not.toThrow();
  });

  test("a campus admin may write in a managed campus", () => {
    expect(() =>
      assertWriteAccess(CAMPUS_ADMIN("Oslo", "1"), "1")
    ).not.toThrow();
  });

  test("a campus admin may not write in another campus", () => {
    expect(() => assertWriteAccess(CAMPUS_ADMIN("Oslo", "1"), "2")).toThrow(
      DO_NOT_MANAGE_I_RE
    );
  });

  test("a campus admin with no campus argument is refused", () => {
    // Omitting the campus must not be a way past the check.
    expect(() => assertWriteAccess(CAMPUS_ADMIN("Oslo", "1"))).toThrow();
  });

  test("a department member may write their own department", () => {
    expect(() =>
      assertWriteAccess(
        DEPARTMENT_MEMBER("dept-esn-oslo", "1"),
        "1",
        "dept-esn-oslo"
      )
    ).not.toThrow();
  });

  test("a department member may not write another department in the same campus", () => {
    expect(() =>
      assertWriteAccess(
        DEPARTMENT_MEMBER("dept-esn-oslo", "1"),
        "1",
        "dept-other"
      )
    ).toThrow(NO_WRITE_ACCESS_TO_THIS_DEPARTMENT_I_RE);
  });

  test("a department member may not write their own department in another campus", () => {
    expect(() =>
      assertWriteAccess(
        DEPARTMENT_MEMBER("dept-esn-oslo", "1"),
        "2",
        "dept-esn-oslo"
      )
    ).toThrow(NO_ACCESS_TO_BERGEN_CAMPUS_I_RE);
  });

  test("an anonymous principal can never write", () => {
    expect(() => assertWriteAccess(ANONYMOUS(), "1", "dept-x")).toThrow(
      VERIFIED_IDENTITY_I_RE
    );
  });
});

describe("assertPublishAccess", () => {
  test("publishing follows the same scope as writing", () => {
    expect(() =>
      assertPublishAccess(CAMPUS_ADMIN("Oslo", "1"), "1")
    ).not.toThrow();
    expect(() => assertPublishAccess(CAMPUS_ADMIN("Oslo", "1"), "2")).toThrow();
  });

  test("a department member cannot publish campus-wide content", () => {
    // Without a department argument the stricter campus/global rule applies.
    expect(() =>
      assertPublishAccess(DEPARTMENT_MEMBER("dept-esn-oslo", "1"), "1")
    ).toThrow();
  });
});

describe("canReadRow", () => {
  test("mirrors assertWriteAccess without throwing", () => {
    expect(canReadRow(GLOBAL_ADMIN(), "9", null)).toBe(true);
    expect(canReadRow(CAMPUS_ADMIN("Oslo", "1"), "1")).toBe(true);
    expect(canReadRow(CAMPUS_ADMIN("Oslo", "1"), "2")).toBe(false);
    expect(canReadRow(DEPARTMENT_MEMBER("dept-a", "1"), "1", "dept-a")).toBe(
      true
    );
    expect(canReadRow(DEPARTMENT_MEMBER("dept-a", "1"), "1", "dept-b")).toBe(
      false
    );
  });
});

describe("canPublish", () => {
  test("it answers exactly what assertPublishAccess decides", () => {
    // The predicate it replaced recognised only global and campus admins, and
    // this test asserted that — which was the invented policy written down as
    // an expectation. `apps/admin`'s `assertPublishAccess` delegates to
    // `assertWriteAccess`, and so does the port, so the department that owns
    // the row can publish it.
    expect(canPublish(GLOBAL_ADMIN(), null)).toBe(true);
    expect(canPublish(CAMPUS_ADMIN("Oslo", "1"), "1")).toBe(true);
    expect(canPublish(CAMPUS_ADMIN("Oslo", "1"), "2")).toBe(false);
    expect(canPublish(DEPARTMENT_MEMBER("dept-a", "1"), "1", "dept-a")).toBe(
      true
    );
    expect(canPublish(DEPARTMENT_MEMBER("dept-a", "1"), "1", "dept-b")).toBe(
      false
    );
  });

  test("it agrees with the gate on every case the gate is tested for", () => {
    // The property, not a sample of it: derived from `assertPublishAccess`, so
    // the two cannot disagree. Restating the rules here instead would be a
    // second copy of exactly the kind that drifted.
    const cases: [
      ReturnType<typeof GLOBAL_ADMIN>,
      string | null,
      string | null,
    ][] = [
      [GLOBAL_ADMIN(), "2", "dept-z"],
      [CAMPUS_ADMIN("Oslo", "1"), "1", "dept-a"],
      [CAMPUS_ADMIN("Oslo", "1"), "2", "dept-a"],
      [DEPARTMENT_MEMBER("dept-a", "1"), "1", "dept-a"],
      [DEPARTMENT_MEMBER("dept-a", "1"), "2", "dept-a"],
      [DEPARTMENT_MEMBER("dept-a", "1"), "1", null],
    ];
    for (const [principal, campusId, departmentId] of cases) {
      let gateAllowed = true;
      try {
        assertPublishAccess(principal, campusId, departmentId);
      } catch {
        gateAllowed = false;
      }
      expect(canPublish(principal, campusId, departmentId)).toBe(gateAllowed);
    }
  });
});

describe("rowOwnership", () => {
  test("relationship columns are canonical", () => {
    expect(
      rowOwnership({
        campus: { $id: "1" },
        campus_id: "9",
        department: { $id: "dept-a" },
        department_id: "dept-z",
      })
    ).toEqual({ campusId: "1", departmentId: "dept-a" });
  });

  test("scalar columns are ignored unless the legacy fallback is requested", () => {
    expect(rowOwnership({ campus_id: "1", department_id: "dept-a" })).toEqual({
      campusId: null,
      departmentId: null,
    });
    expect(
      rowOwnership(
        { campus_id: "1", department_id: "dept-a" },
        { legacyFallback: true }
      )
    ).toEqual({ campusId: "1", departmentId: "dept-a" });
  });

  test("relationId normalises both shapes", () => {
    expect(relationId("abc")).toBe("abc");
    expect(relationId({ $id: "abc" })).toBe("abc");
    expect(relationId(null)).toBeNull();
    expect(relationId(undefined)).toBeNull();
  });
});

describe("describeScope", () => {
  test("reports the level and the ids a query was narrowed to", () => {
    expect(describeScope(GLOBAL_ADMIN()).level).toBe("global");
    expect(describeScope(CAMPUS_ADMIN("Oslo", "1")).campusIds).toEqual(["1"]);
    expect(
      describeScope(DEPARTMENT_MEMBER("dept-a", "1")).departmentIds
    ).toEqual(["dept-a"]);
    expect(describeScope(ANONYMOUS()).level).toBe("public");
  });

  test("a department member on a department-less table is told they see nothing", () => {
    const scope = describeScope(DEPARTMENT_MEMBER(), {
      departmentField: null,
    });
    expect(scope.summary).toMatch(NO_ROWS_I_RE);
  });
});

import { describe, expect, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "../authorization";
import {
  applyScopeQueries,
  assertPublishAccess,
  assertWriteAccess,
  hasRowAccess,
} from "./authorization";

const NO_MATCH_FILTER = Query.equal("$id", "__no_scope_resolved__");

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

const globalAdmin = makeCtx({ roles: ["globaladmin"] });
const campusAdmin = makeCtx({
  campusNames: ["Oslo"],
  campusTeamIds: ["sg-app-campus-oslo"],
  managedCampuses: ["Oslo"],
  managedCampusIds: ["1"],
  resolvedCampusIds: ["1"],
  roles: ["campusadmin"],
});
const departmentUser = makeCtx({
  campusNames: ["Oslo"],
  departmentNames: ["Sosialutvalget"],
  departmentTeamIds: ["sg-app-dept-sosialutvalget"],
  resolvedCampusIds: ["1"],
  resolvedDepartmentIds: ["dept-1"],
});
// Department membership at the team level but the lookup never resolved a
// concrete Appwrite Departments id (renamed/missing/name mismatch).
const departmentUserUnresolved = makeCtx({
  departmentTeamIds: ["sg-app-dept-unknown"],
  resolvedCampusIds: ["1"],
});
// Brand-new account with no group assignments at all.
const noScopeUser = makeCtx();

describe("applyScopeQueries", () => {
  test("global admin sees everything (no filter)", () => {
    expect(applyScopeQueries(globalAdmin)).toEqual([]);
  });

  test("global admin scoped to an active campus filters by that campus", () => {
    const scoped = makeCtx({ activeCampusId: "2", roles: ["globaladmin"] });
    expect(applyScopeQueries(scoped)).toEqual([
      Query.equal("campus_id", ["2"]),
    ]);
  });

  test("campus admin is filtered to their managed campus ids", () => {
    expect(applyScopeQueries(campusAdmin)).toEqual([
      Query.equal("campus_id", ["1"]),
    ]);
  });

  test("department user is filtered to BOTH their campus and department", () => {
    expect(applyScopeQueries(departmentUser)).toEqual([
      Query.equal("campus_id", ["1"]),
      Query.equal("department_id", ["dept-1"]),
    ]);
  });

  test("department user honors a custom department field name", () => {
    expect(
      applyScopeQueries(departmentUser, { departmentField: "departmentId" })
    ).toEqual([
      Query.equal("campus_id", ["1"]),
      Query.equal("departmentId", ["dept-1"]),
    ]);
  });

  test("department user on a campus-only collection is hidden (fails closed)", () => {
    expect(
      applyScopeQueries(departmentUser, { departmentField: null })
    ).toEqual([NO_MATCH_FILTER]);
  });

  test("department membership that did not resolve fails closed", () => {
    expect(applyScopeQueries(departmentUserUnresolved)).toEqual([
      NO_MATCH_FILTER,
    ]);
  });

  test("account with no scope at all fails closed", () => {
    expect(applyScopeQueries(noScopeUser)).toEqual([NO_MATCH_FILTER]);
  });

  test("campus admin uses a custom campus field name", () => {
    expect(
      applyScopeQueries(campusAdmin, { campusField: "campus.$id" })
    ).toEqual([Query.equal("campus.$id", ["1"])]);
  });

  test("campus admin on a collection without a campus dimension is unscoped", () => {
    expect(applyScopeQueries(campusAdmin, { campusField: null })).toEqual([]);
  });

  test("SECURITY: a non-global user is never returned an empty (unscoped) filter on a scoped collection", () => {
    for (const ctx of [
      campusAdmin,
      departmentUser,
      departmentUserUnresolved,
      noScopeUser,
    ]) {
      expect(applyScopeQueries(ctx).length).toBeGreaterThan(0);
    }
  });
});

describe("assertWriteAccess", () => {
  test("global admin can write to any campus", () => {
    expect(() => assertWriteAccess(globalAdmin, "99")).not.toThrow();
  });

  test("campus admin can write within a managed campus", () => {
    expect(() => assertWriteAccess(campusAdmin, "1")).not.toThrow();
  });

  test("campus admin cannot write to an unmanaged campus", () => {
    expect(() => assertWriteAccess(campusAdmin, "2")).toThrow(
      "Unauthorized: no write access to this campus"
    );
  });

  test("campus admin cannot write without a campus id", () => {
    expect(() => assertWriteAccess(campusAdmin, null)).toThrow(
      "Unauthorized: no write access to this campus"
    );
  });

  test("department user can write within their campus and department", () => {
    expect(() =>
      assertWriteAccess(departmentUser, "1", "dept-1")
    ).not.toThrow();
  });

  test("department user cannot write to another campus", () => {
    expect(() => assertWriteAccess(departmentUser, "2", "dept-1")).toThrow(
      "Unauthorized: no access to this campus"
    );
  });

  test("department user cannot write outside their department", () => {
    expect(() => assertWriteAccess(departmentUser, "1", "dept-other")).toThrow(
      "Unauthorized: no write access to this department"
    );
  });
});

describe("hasRowAccess", () => {
  test("global admin can read any row", () => {
    expect(hasRowAccess(globalAdmin)).toBe(true);
  });

  test("campus admin can read only managed-campus rows", () => {
    expect(hasRowAccess(campusAdmin, "1")).toBe(true);
    expect(hasRowAccess(campusAdmin, "2")).toBe(false);
    expect(hasRowAccess(campusAdmin, null)).toBe(false);
  });

  test("department user can read only their campus + department rows", () => {
    expect(hasRowAccess(departmentUser, "1", "dept-1")).toBe(true);
    expect(hasRowAccess(departmentUser, "2", "dept-1")).toBe(false);
    expect(hasRowAccess(departmentUser, "1", "dept-other")).toBe(false);
    expect(hasRowAccess(departmentUser, "1")).toBe(false);
  });
});

describe("assertPublishAccess", () => {
  test("global admin can publish anywhere", () => {
    expect(() => assertPublishAccess(globalAdmin, "99")).not.toThrow();
  });

  test("campus admin can publish within a managed campus", () => {
    expect(() => assertPublishAccess(campusAdmin, "1")).not.toThrow();
  });

  test("campus admin cannot publish to an unmanaged campus", () => {
    expect(() => assertPublishAccess(campusAdmin, "2")).toThrow(
      "Forbidden: publish requires campus or global admin access"
    );
  });

  test("department user cannot publish even within their own campus", () => {
    expect(() => assertPublishAccess(departmentUser, "1")).toThrow(
      "Forbidden: publish requires campus or global admin access"
    );
  });
});

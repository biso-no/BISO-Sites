import { describe, expect, test } from "bun:test";
import type { UserAuthContext } from "./authorization";
import { NATIONAL_CAMPUS_ID, withNationalEventScope } from "./event-scope";

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

describe("withNationalEventScope", () => {
  test("adds National to a campus admin's managed campuses", () => {
    const ctx = makeCtx({ managedCampusIds: ["1"], roles: ["campusadmin"] });
    expect(withNationalEventScope(ctx).managedCampusIds).toEqual([
      "1",
      NATIONAL_CAMPUS_ID,
    ]);
    expect(ctx.managedCampusIds).toEqual(["1"]);
  });

  test("leaves global admins unchanged", () => {
    const ctx = makeCtx({ roles: ["globaladmin"] });
    expect(withNationalEventScope(ctx)).toBe(ctx);
  });

  test("leaves department users unchanged", () => {
    const ctx = makeCtx({
      resolvedCampusIds: ["1"],
      resolvedDepartmentIds: ["dept-1"],
    });
    expect(withNationalEventScope(ctx)).toBe(ctx);
  });

  test("does not duplicate National", () => {
    const ctx = makeCtx({
      managedCampusIds: ["1", NATIONAL_CAMPUS_ID],
      roles: ["campusadmin"],
    });
    expect(withNationalEventScope(ctx)).toBe(ctx);
  });
});

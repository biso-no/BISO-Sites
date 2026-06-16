import { describe, expect, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import { isHrDepartment, toRecruitmentAdminScope } from "./recruitment";

function ctx(partial: Partial<UserAuthContext>): UserAuthContext {
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
    ...partial,
  };
}

describe("isHrDepartment", () => {
  test("matches HR regardless of casing/whitespace", () => {
    expect(isHrDepartment(["HR"])).toBe(true);
    expect(isHrDepartment(["hr"])).toBe(true);
    expect(isHrDepartment([" Hr "])).toBe(true);
    expect(isHrDepartment(["Marketing", "HR"])).toBe(true);
  });
  test("does not match non-HR departments", () => {
    expect(isHrDepartment(["Marketing"])).toBe(false);
    expect(isHrDepartment([])).toBe(false);
  });
});

describe("toRecruitmentAdminScope", () => {
  test("global admin manages any campus", () => {
    const scope = toRecruitmentAdminScope(ctx({ roles: ["globaladmin"] }));
    expect(scope.canManageAnyCampus).toBe(true);
    expect(scope.isGlobalAdmin).toBe(true);
  });

  test("HR + National manages any campus", () => {
    const scope = toRecruitmentAdminScope(
      ctx({ campusNames: ["National"], departmentNames: ["HR"] })
    );
    expect(scope.canManageAnyCampus).toBe(true);
    expect(scope.isGlobalAdmin).toBe(true);
    expect(scope.isCampusAdmin).toBe(false);
  });

  test("HR + single campus is a campus-scoped recruitment admin", () => {
    const scope = toRecruitmentAdminScope(
      ctx({ campusNames: ["Oslo"], departmentNames: ["HR"] })
    );
    expect(scope.canManageAnyCampus).toBe(false);
    expect(scope.isGlobalAdmin).toBe(false);
    expect(scope.isCampusAdmin).toBe(true);
    expect(scope.managedCampusNames).toEqual(["Oslo"]);
    expect(scope.managedDepartmentNames).toEqual([]);
  });

  test("HR + multiple campuses scopes to those campuses", () => {
    const scope = toRecruitmentAdminScope(
      ctx({ campusNames: ["Oslo", "Bergen"], departmentNames: ["HR"] })
    );
    expect(scope.isCampusAdmin).toBe(true);
    expect(scope.managedCampusNames).toEqual(["Oslo", "Bergen"]);
  });

  test("non-HR, non-global user gets no recruitment access", () => {
    const scope = toRecruitmentAdminScope(
      ctx({ campusNames: ["Oslo"], departmentNames: ["Marketing"] })
    );
    expect(scope.canManageAnyCampus).toBe(false);
    expect(scope.isGlobalAdmin).toBe(false);
    expect(scope.isCampusAdmin).toBe(false);
    expect(scope.managedCampusNames).toEqual([]);
    expect(scope.managedDepartmentNames).toEqual([]);
  });
});

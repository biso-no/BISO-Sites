import { describe, expect, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import {
  buildJobRowPermissions,
  buildJobTranslationPermissions,
  isHrDepartment,
  toRecruitmentAdminScope,
} from "./recruitment";

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

describe("buildJobTranslationPermissions", () => {
  test("keeps recruitment staff access with parent-equivalent visibility", () => {
    const published = buildJobTranslationPermissions("public", "published");
    expect(published).toContain('read("any")');
    expect(published).toContain('update("team:sg-app-dept-operationsunit")');
    expect(published).toContain('update("team:sg-app-dept-hr")');

    const draft = buildJobTranslationPermissions("public", "draft");
    expect(draft).not.toContain('read("any")');
    expect(draft).toContain('read("team:sg-app-dept-hr")');
  });
});

describe("buildJobRowPermissions", () => {
  test("published + public is world-readable plus Operations Unit/HR staff grant", () => {
    const perms = buildJobRowPermissions("public", "published");
    expect(perms).toContain('read("any")');
    expect(perms).toContain('read("team:sg-app-dept-operationsunit")');
    expect(perms).toContain('update("team:sg-app-dept-operationsunit")');
    expect(perms).toContain('read("team:sg-app-dept-hr")');
    expect(perms).toContain('update("team:sg-app-dept-hr")');
    expect(perms.join(" ")).not.toContain("sg-app-campus-");
    expect(perms.join(" ")).not.toContain("team:admin");
  });

  test("published + members swaps read(any) for biso-members", () => {
    const perms = buildJobRowPermissions("members", "published");
    expect(perms).not.toContain('read("any")');
    expect(perms).toContain('read("team:biso-members")');
    expect(perms).toContain('read("team:sg-app-dept-hr")');
  });

  test("draft is never public and never member-readable", () => {
    const perms = buildJobRowPermissions("public", "draft");
    expect(perms).not.toContain('read("any")');
    expect(perms).not.toContain('read("team:biso-members")');
    expect(perms).toContain('read("team:sg-app-dept-hr")');
  });
});

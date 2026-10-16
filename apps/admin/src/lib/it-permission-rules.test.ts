import { describe, expect, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import { getItCampusScope, getItPermissions } from "./it-permission-rules";

function context(overrides: Partial<UserAuthContext>): UserAuthContext {
  return {
    campusNames: [],
    campusTeamIds: [],
    departmentNames: [],
    departmentTeamIds: [],
    email: "user@biso.no",
    managedCampuses: [],
    managedCampusIds: [],
    name: "Test User",
    resolvedCampusIds: [],
    resolvedDepartmentIds: [],
    roles: [],
    userId: "user-1",
    ...overrides,
  };
}

const globalAdmin = context({
  campusNames: ["National"],
  departmentNames: ["Operations Unit"],
  roles: ["globaladmin"],
});

const osloCampusAdmin = context({
  campusNames: ["Oslo"],
  departmentNames: ["Ledelsen Oslo"],
  managedCampuses: ["Oslo"],
  roles: ["campusadmin"],
});

const departmentUser = context({
  campusNames: ["Oslo"],
  departmentNames: ["Sosialutvalget"],
  roles: [],
});

describe("getItPermissions", () => {
  test("global admin holds every IT permission", () => {
    const permissions = getItPermissions(globalAdmin);
    expect(Object.values(permissions).every(Boolean)).toBe(true);
  });

  test("campus admin gets read-only access, never a mutation", () => {
    const permissions = getItPermissions(osloCampusAdmin);

    expect(permissions["it.users.view"]).toBe(true);
    expect(permissions["it.users.viewSecurity"]).toBe(true);

    for (const permission of [
      "it.users.create",
      "it.users.editProfile",
      "it.users.disable",
      "it.users.manageAliases",
      "it.users.transferAlias",
      "it.users.manageManagers",
      "it.users.manageGroups",
      "it.users.manageLicenses",
      "it.users.resetMfa",
      "it.users.revokeSessions",
      "it.users.resetPassword",
      "it.users.turnover",
    ] as const) {
      expect(permissions[permission]).toBe(false);
    }
  });

  test("campus admin never reaches the tenant-wide audit tooling", () => {
    expect(getItPermissions(osloCampusAdmin)["it.tenant.audit"]).toBe(false);
    expect(getItPermissions(globalAdmin)["it.tenant.audit"]).toBe(true);
  });

  test("a campus admin with no managed campus gets nothing", () => {
    const unscoped = context({ roles: ["campusadmin"], managedCampuses: [] });
    expect(getItPermissions(unscoped)["it.users.view"]).toBe(false);
  });

  test("a plain department member gets nothing", () => {
    const permissions = getItPermissions(departmentUser);
    expect(Object.values(permissions).some(Boolean)).toBe(false);
  });
});

describe("getItCampusScope", () => {
  test("global admin is unrestricted", () => {
    expect(getItCampusScope(globalAdmin)).toBeNull();
  });

  test("campus admin is limited to the campuses they manage", () => {
    expect(getItCampusScope(osloCampusAdmin)).toEqual(["Oslo"]);
  });

  test("everyone else resolves to an empty scope, which matches nothing", () => {
    expect(getItCampusScope(departmentUser)).toEqual([]);
  });
});

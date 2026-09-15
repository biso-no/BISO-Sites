/**
 * Principal derivation tests.
 *
 * The central property: identity and roles come from the backend's answer to
 * `teams.list()`, and nothing a caller can send changes them. There is no tool
 * argument, environment variable or request field anywhere in this package that
 * adds a role — these tests pin the derivation so a future change that
 * introduced one would have to delete a test to pass.
 */

import { describe, expect, test } from "bun:test";
import { collectingLogger, createFakeBackend } from "../testing/index";
import {
  deriveRoles,
  isHrDepartment,
  parseTeamMemberships,
  resolvePrincipal,
  resolveProfile,
} from "./resolve";

describe("parseTeamMemberships", () => {
  test("recognises bare campus names", () => {
    const parsed = parseTeamMemberships([
      { $id: "t1", name: "Oslo" },
      { $id: "t2", name: "National" },
    ]);
    expect(parsed.campusNames).toEqual(["Oslo", "National"]);
    expect(parsed.departmentNames).toEqual([]);
  });

  test("recognises the legacy SG-App-Campus- prefix", () => {
    const parsed = parseTeamMemberships([
      { $id: "t1", name: "SG-App-Campus-Bergen" },
    ]);
    expect(parsed.campusNames).toEqual(["Bergen"]);
  });

  test("expands camelCase department names behind the legacy prefix", () => {
    const parsed = parseTeamMemberships([
      { $id: "t1", name: "SG-App-Dept-OperationsUnit" },
    ]);
    expect(parsed.departmentNames).toEqual(["Operations Unit"]);
  });

  test("recognises departments by their sg-app-dept- id", () => {
    const parsed = parseTeamMemberships([
      { $id: "sg-app-dept-hr", name: "HR" },
    ]);
    expect(parsed.departmentTeamIds).toEqual(["sg-app-dept-hr"]);
    expect(parsed.departmentNames).toEqual(["HR"]);
  });

  test("IGNORES teams that are neither a campus nor an SG-App department", () => {
    // `biso-members` is every member's team. `apps/api`'s normalizeTeamName
    // would classify it as a department, which is the divergence this package
    // deliberately does not inherit.
    const parsed = parseTeamMemberships([
      { $id: "biso-members", name: "biso-members" },
      { $id: "random", name: "Some Other Team" },
    ]);
    expect(parsed.departmentNames).toEqual([]);
    expect(parsed.campusNames).toEqual([]);
    expect(parsed.roles).toEqual([]);
  });

  test("derives the hr role from HR department membership", () => {
    expect(
      parseTeamMemberships([{ $id: "sg-app-dept-hr", name: "HR" }]).roles
    ).toContain("hr");
  });
});

describe("isHrDepartment", () => {
  test("matches regardless of spacing and case", () => {
    expect(isHrDepartment(["HR"])).toBe(true);
    expect(isHrDepartment(["hr"])).toBe(true);
    expect(isHrDepartment(["H R"])).toBe(true);
    expect(isHrDepartment(["Human Resources"])).toBe(false);
    expect(isHrDepartment(["ESN Oslo"])).toBe(false);
  });
});

describe("deriveRoles", () => {
  test("National + Operations Unit grants globaladmin", () => {
    const { roles } = deriveRoles({
      campusNames: ["National"],
      campusTeamIds: [],
      departmentNames: ["Operations Unit"],
      departmentTeamIds: [],
      roles: [],
    });
    expect(roles).toContain("globaladmin");
  });

  test("National alone does NOT grant globaladmin", () => {
    const { roles } = deriveRoles({
      campusNames: ["National"],
      campusTeamIds: [],
      departmentNames: ["ESN Oslo"],
      departmentTeamIds: [],
      roles: [],
    });
    expect(roles).not.toContain("globaladmin");
  });

  test("Operations Unit alone does NOT grant globaladmin", () => {
    const { roles } = deriveRoles({
      campusNames: ["Oslo"],
      campusTeamIds: [],
      departmentNames: ["Operations Unit"],
      departmentTeamIds: [],
      roles: [],
    });
    expect(roles).not.toContain("globaladmin");
  });

  test("Campus + Ledelsen grants campusadmin for that campus only", () => {
    const { roles, managedCampuses } = deriveRoles({
      campusNames: ["Oslo"],
      campusTeamIds: [],
      departmentNames: ["Ledelsen Oslo"],
      departmentTeamIds: [],
      roles: [],
    });
    expect(roles).toContain("campusadmin");
    expect(managedCampuses).toEqual(["Oslo"]);
  });

  test("Ledelsen for a campus you are not on grants nothing", () => {
    const { managedCampuses } = deriveRoles({
      campusNames: ["Bergen"],
      campusTeamIds: [],
      departmentNames: ["Ledelsen Oslo"],
      departmentTeamIds: [],
      roles: [],
    });
    expect(managedCampuses).toEqual([]);
  });
});

describe("resolveProfile", () => {
  test("global admin becomes it-operator", () => {
    expect(
      resolveProfile({ roles: ["globaladmin"], departmentTeamIds: [] })
    ).toBe("it-operator");
  });

  test("campus admin and department member become staff", () => {
    expect(
      resolveProfile({ roles: ["campusadmin"], departmentTeamIds: [] })
    ).toBe("staff");
    expect(
      resolveProfile({ roles: [], departmentTeamIds: ["sg-app-dept-esn"] })
    ).toBe("staff");
  });

  test("a signed-in user with no admin team is a member", () => {
    expect(resolveProfile({ roles: [], departmentTeamIds: [] })).toBe("member");
  });

  test("the hr role alone does not reach it-operator", () => {
    expect(resolveProfile({ roles: ["hr"], departmentTeamIds: [] })).toBe(
      "member"
    );
  });
});

describe("resolvePrincipal", () => {
  test("returns the anonymous principal when no user credential is configured", async () => {
    const { logger } = collectingLogger();
    const backend = createFakeBackend({ hasUserCredential: false });
    const principal = await resolvePrincipal(backend, logger);
    expect(principal.userId).toBe("");
    expect(principal.profile).toBe("public");
    expect(principal.roles).toEqual([]);
  });

  test("a service key alone never produces an identity", async () => {
    // `hasElevated` is true here and `hasUserCredential` is false: a configured
    // service key must not be mistaken for a principal, because it bypasses row
    // security and belongs to no user.
    const { logger } = collectingLogger();
    const backend = createFakeBackend({
      hasUserCredential: false,
      hasElevated: true,
    });
    const principal = await resolvePrincipal(backend, logger);
    expect(principal.profile).toBe("public");
    expect(principal.userId).toBe("");
  });

  test("activeCampusId is always undefined", async () => {
    // Nothing may narrow (or widen) a global admin's campus from outside.
    const { logger } = collectingLogger();
    const backend = createFakeBackend({ hasUserCredential: false });
    const principal = await resolvePrincipal(backend, logger);
    expect(principal.activeCampusId).toBeUndefined();
  });
});

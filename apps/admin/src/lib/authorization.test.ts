import { beforeEach, describe, expect, mock, test } from "bun:test";

const account = {
  get: mock(),
};
const db = {
  listRows: mock(),
};
const teams = {
  list: mock(),
};

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ account, teams })),
}));

// `headers` is included alongside `cookies` even though this file's code
// under test never calls it: `mock.module("next/headers", ...)` replaces the
// whole module process-wide, and member-pass.test.ts (which does call
// `headers()`) shares this registry entry within the same `bun test` run —
// whichever file's factory is registered last would otherwise strip the
// export the other needs.
mock.module("next/headers", () => ({
  cookies: mock(async () => ({
    get: mock(() => undefined),
  })),
  headers: mock(async () => new Headers()),
}));

const { parseTeamMemberships } = await import(
  "./authorization-team-memberships"
);
const { getUserRolesForClient } = await import("./authorization");
const { hasNavAccess } = await import("./roles");

describe("admin authorization team parsing", () => {
  beforeEach(() => {
    account.get.mockReset();
    db.listRows.mockReset();
    teams.list.mockReset();

    account.get.mockResolvedValue({
      $id: "user-1",
      email: "member@example.com",
      name: "Member Person",
    });
    db.listRows.mockResolvedValue({ rows: [], total: 0 });
  });

  test("plain membership teams do not grant department admin access", async () => {
    teams.list.mockResolvedValue({
      teams: [{ $id: "biso-members", name: "BISO Members" }],
    });

    const roles = await getUserRolesForClient();

    expect(roles.hasDepartmentMembership).toBe(false);
    expect(roles.departmentNames).toEqual([]);
    expect(roles.roles).toEqual([]);
    expect(hasNavAccess("portal.pages", roles.roles, false)).toBe(false);
  });

  test("only SG-App department teams contribute the department pseudo-role", () => {
    const parsed = parseTeamMemberships([
      { $id: "biso-members", name: "BISO Members" },
      { $id: "sg-app-dept-hr", name: "HR" },
      { $id: "legacy-guid", name: "SG-App-Dept-OperationsUnit" },
      { $id: "sg-app-campus-oslo", name: "Oslo" },
    ]);

    expect(parsed.departmentTeamIds).toEqual(["sg-app-dept-hr", "legacy-guid"]);
    expect(parsed.departmentNames).toEqual(["HR", "Operations Unit"]);
    expect(parsed.campusTeamIds).toEqual(["sg-app-campus-oslo"]);
    expect(parsed.campusNames).toEqual(["Oslo"]);
  });

  test("only HR department names derive the hr role", () => {
    const hr = parseTeamMemberships([{ $id: "sg-app-dept-hr", name: "HR" }]);
    expect(hr.roles).toContain("hr");

    const spaced = parseTeamMemberships([
      { $id: "sg-app-dept-hr", name: " h r " },
    ]);
    expect(spaced.roles).toContain("hr");

    const marketing = parseTeamMemberships([
      { $id: "sg-app-dept-marketing", name: "Marketing" },
    ]);
    expect(marketing.roles).not.toContain("hr");

    const opsUnit = parseTeamMemberships([
      { $id: "legacy-guid", name: "SG-App-Dept-OperationsUnit" },
    ]);
    expect(opsUnit.roles).not.toContain("hr");
  });
});

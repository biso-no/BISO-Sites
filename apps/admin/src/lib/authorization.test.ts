import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

const account = {
  get: mock(),
  listIdentities: mock(),
};
const db = {
  getRow: mock(),
  listRows: mock(),
};
const teams = {
  list: mock(),
};

interface Team {
  $id: string;
  name: string;
}

/**
 * The session user's teams and their m365_team_sync record. By default the
 * user is synced: the record lists every team they are in. Pass `null` for a
 * user with no record.
 */
function memberOf(
  list: Team[],
  record: string[] | null = list.map((t) => t.$id)
): void {
  teams.list.mockResolvedValue({ teams: list });
  db.getRow.mockReset();
  if (record === null) {
    db.getRow.mockRejectedValue(
      Object.assign(new Error("Row not found"), { code: 404 })
    );
  } else {
    db.getRow.mockResolvedValue({ $id: "user-1", team_ids: record });
  }
}

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

const actualNavigation = await import("next/navigation");

mock.module("next/navigation", () => ({
  ...actualNavigation,
  notFound: mock(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: mock((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
  unauthorized: mock(() => {
    throw new Error("NEXT_UNAUTHORIZED");
  }),
}));

const { parseTeamMemberships } = await import(
  "./authorization-team-memberships"
);
const { getUserAuthContext, getUserRolesForClient, requireAdminAccess } =
  await import("./authorization");
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
    memberOf([{ $id: "biso-members", name: "BISO Members" }]);

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
      { $id: "x", name: "Oslo" },
      { $id: "sg-app-campus-oslo", name: "Oslo" },
    ]);

    expect(parsed.departmentTeamIds).toEqual(["sg-app-dept-hr"]);
    expect(parsed.departmentNames).toEqual(["HR"]);
    expect(parsed.campusTeamIds).toEqual(["sg-app-campus-oslo"]);
    expect(parsed.campusNames).toEqual(["Oslo"]);
  });

  test("only HR department names derive the hr role", () => {
    const hr = parseTeamMemberships([{ $id: "sg-app-dept-hr", name: "HR" }]);
    expect(hr.roles).toContain("hr");

    const renamed = parseTeamMemberships([
      { $id: "sg-app-dept-hr", name: "Renamed" },
    ]);
    expect(renamed.roles).toContain("hr");

    const userMade = parseTeamMemberships([{ $id: "user-made", name: "HR" }]);
    expect(userMade.roles).not.toContain("hr");

    const marketing = parseTeamMemberships([
      { $id: "sg-app-dept-marketing", name: "Marketing" },
    ]);
    expect(marketing.roles).not.toContain("hr");

    const opsUnit = parseTeamMemberships([
      { $id: "sg-app-dept-operationsunit", name: "Operations Unit" },
    ]);
    expect(opsUnit.roles).not.toContain("hr");
  });

  test("user-created teams with copied names grant no admin access", async () => {
    memberOf([
      { $id: "u1", name: "SG-App-Campus-National" },
      { $id: "u2", name: "SG-App-Dept-OperationsUnit" },
      { $id: "u3", name: "Oslo" },
      { $id: "u4", name: "Ledelsen Oslo" },
    ]);

    const roles = await getUserRolesForClient();

    expect(roles.isGlobalAdmin).toBe(false);
    expect(roles.isCampusAdmin).toBe(false);
    expect(roles.campusNames).toEqual([]);
    expect(roles.departmentNames).toEqual([]);
    expect(roles.roles).toEqual([]);
    await expect(requireAdminAccess()).rejects.toThrow("NEXT_UNAUTHORIZED");
  });

  test("synced ids grant global and campus admin", async () => {
    memberOf([
      { $id: "sg-app-campus-national", name: "National" },
      { $id: "sg-app-dept-operationsunit", name: "Operations Unit" },
    ]);
    expect((await getUserRolesForClient()).isGlobalAdmin).toBe(true);

    memberOf([
      { $id: "sg-app-campus-oslo", name: "Oslo" },
      { $id: "sg-app-dept-ledelsenoslo", name: "Ledelsen Oslo" },
    ]);
    const campus = await getUserRolesForClient();
    expect(campus.isCampusAdmin).toBe(true);
    expect(campus.managedCampuses).toEqual(["Oslo"]);
  });
});

describe("teams the Microsoft sync recorded", () => {
  const oslo = { $id: "sg-app-campus-oslo", name: "Oslo" };
  const oslMarketing = {
    $id: "sg-app-dept-oslmarketing",
    name: "OSL Marketing",
  };
  const national = { $id: "sg-app-campus-national", name: "National" };
  const operationsUnit = {
    $id: "sg-app-dept-operationsunit",
    name: "Operations Unit",
  };

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

  test("reads the caller's own record with the admin client", async () => {
    memberOf([oslo]);

    await getUserAuthContext();

    expect(db.getRow).toHaveBeenCalledWith("app", "m365_team_sync", "user-1");
  });

  test("drops a department team the record doesn't list", async () => {
    memberOf([oslo, oslMarketing], ["sg-app-campus-oslo"]);

    const ctx = await getUserAuthContext();

    expect(ctx?.departmentTeamIds).toEqual([]);
    expect(ctx?.departmentNames).toEqual([]);
    expect(ctx?.campusTeamIds).toEqual(["sg-app-campus-oslo"]);
    expect(ctx?.campusNames).toEqual(["Oslo"]);
  });

  test("keeps every team the record lists", async () => {
    memberOf([oslo, oslMarketing], ["sg-app-dept-oslmarketing", oslo.$id]);

    const ctx = await getUserAuthContext();

    expect(ctx?.departmentTeamIds).toEqual(["sg-app-dept-oslmarketing"]);
    expect(ctx?.departmentNames).toEqual(["OSL Marketing"]);
    expect(ctx?.campusNames).toEqual(["Oslo"]);
  });

  test("a user without a record gets no sg-app teams", async () => {
    memberOf([oslo, oslMarketing, national, operationsUnit], null);

    const ctx = await getUserAuthContext();

    expect(ctx?.campusTeamIds).toEqual([]);
    expect(ctx?.campusNames).toEqual([]);
    expect(ctx?.departmentTeamIds).toEqual([]);
    expect(ctx?.roles).toEqual([]);
    await expect(requireAdminAccess()).rejects.toThrow("NEXT_UNAUTHORIZED");
  });

  test("global admin teams the record doesn't list grant nothing", async () => {
    memberOf([national, operationsUnit, oslo], [oslo.$id]);

    const roles = await getUserRolesForClient();

    expect(roles.isGlobalAdmin).toBe(false);
    expect(roles.roles).not.toContain("globaladmin");
    expect(roles.campusNames).toEqual(["Oslo"]);
  });

  test("an outage reading the record is not treated as no access", async () => {
    memberOf([oslo]);
    const outage = Object.assign(new Error("service unavailable"), {
      code: 503,
    });
    db.getRow.mockRejectedValue(outage);

    await expect(getUserAuthContext()).rejects.toBe(outage);
  });
});

describe("benefits editor role", () => {
  const originalEditorEmails = process.env.BENEFITS_EDITOR_EMAILS;
  const editorEmail = "pr@biso.no";

  afterAll(() => {
    if (originalEditorEmails === undefined) {
      Reflect.deleteProperty(process.env, "BENEFITS_EDITOR_EMAILS");
    } else {
      process.env.BENEFITS_EDITOR_EMAILS = originalEditorEmails;
    }
  });
  const microsoft = [{ provider: "microsoft", providerEmail: "PR@biso.no" }];

  beforeEach(() => {
    process.env.BENEFITS_EDITOR_EMAILS = editorEmail;
    account.get.mockReset();
    account.listIdentities.mockReset();
    teams.list.mockReset();
    db.listRows.mockReset();
    db.listRows.mockResolvedValue({ rows: [], total: 0 });
    memberOf([]);
    account.get.mockResolvedValue({
      $id: "user-2",
      email: editorEmail,
      name: "PR",
    });
    account.listIdentities.mockResolvedValue({ identities: microsoft });
  });

  test("granted once for a listed email with a microsoft identity", async () => {
    const { roles } = await getUserRolesForClient();
    expect(roles.filter((r) => r === "benefitseditor")).toHaveLength(1);
  });

  test("absent when the env is unset or empty", async () => {
    process.env.BENEFITS_EDITOR_EMAILS = "";
    expect((await getUserRolesForClient()).roles).not.toContain(
      "benefitseditor"
    );
    Reflect.deleteProperty(process.env, "BENEFITS_EDITOR_EMAILS");
    expect((await getUserRolesForClient()).roles).not.toContain(
      "benefitseditor"
    );
  });

  test("absent when the account has no microsoft identity", async () => {
    account.listIdentities.mockResolvedValue({ identities: [] });
    expect((await getUserRolesForClient()).roles).not.toContain(
      "benefitseditor"
    );
  });

  test("fails closed when listIdentities throws", async () => {
    account.listIdentities.mockRejectedValue(new Error("boom"));
    memberOf([{ $id: "sg-app-dept-hr", name: "HR" }]);
    const result = await getUserRolesForClient();
    expect(result.roles).not.toContain("benefitseditor");
    expect(result.roles).toContain("hr");
    expect(result.hasDepartmentMembership).toBe(true);
    expect(result.departmentNames).toEqual(["HR"]);
    const ctx = await requireAdminAccess();
    expect(ctx.departmentTeamIds).toEqual(["sg-app-dept-hr"]);
  });

  test("requireAdminAccess admits a teamless editor", async () => {
    const ctx = await requireAdminAccess();
    expect(ctx.roles).toContain("benefitseditor");
  });

  test("requireAdminAccess rejects a teamless non-editor", async () => {
    account.get.mockResolvedValue({
      $id: "user-3",
      email: "other@biso.no",
      name: "Other",
    });
    await expect(requireAdminAccess()).rejects.toThrow("NEXT_UNAUTHORIZED");
  });
});

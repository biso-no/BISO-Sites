import { beforeEach, describe, expect, mock, test } from "bun:test";

const account = {
  get: mock(),
  listIdentities: mock(),
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

mock.module("next/navigation", () => ({
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
const { getUserRolesForClient, requireAdminAccess } = await import(
  "./authorization"
);
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

describe("benefits editor role", () => {
  const editorEmail = "pr@biso.no";
  const microsoft = [{ provider: "microsoft", providerEmail: "PR@biso.no" }];

  beforeEach(() => {
    process.env.BENEFITS_EDITOR_EMAILS = editorEmail;
    account.get.mockReset();
    account.listIdentities.mockReset();
    teams.list.mockReset();
    db.listRows.mockReset();
    db.listRows.mockResolvedValue({ rows: [], total: 0 });
    teams.list.mockResolvedValue({ teams: [] });
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
    const result = await getUserRolesForClient();
    expect(result.roles).not.toContain("benefitseditor");
    expect(result.roles).toEqual([]);
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

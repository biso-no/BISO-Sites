import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

const account = { get: mock(), listIdentities: mock() };
const db = { getRow: mock(), listRows: mock() };
const teams = { list: mock() };

mock.module("server-only", () => ({}));
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ account, teams })),
}));
mock.module("next/headers", () => ({
  cookies: mock(async () => ({ get: mock(() => undefined) })),
  headers: mock(async () => new Headers()),
}));

const { getExpenseViewer } = await import("./expense-viewer");

const GLOBAL_TEAMS = [
  { $id: "sg-app-campus-national", name: "National" },
  { $id: "sg-app-dept-operationsunit", name: "Operations Unit" },
];

function signIn(teamList: { $id: string; name: string }[] = []): void {
  account.get.mockResolvedValue({
    $id: "user-1",
    email: "Bare.Account@biso.no",
    name: "Role Mailbox",
  });
  teams.list.mockResolvedValue({ teams: teamList });
  db.getRow.mockResolvedValue({
    $id: "user-1",
    team_ids: teamList.map((t) => t.$id),
  });
}

const controllerRows = () =>
  db.listRows.mock.calls.filter((c) => c[1] === "expense_approvers");

describe("getExpenseViewer", () => {
  beforeEach(() => {
    for (const fn of [
      account.get,
      account.listIdentities,
      db.getRow,
      db.listRows,
      teams.list,
    ]) {
      fn.mockReset();
    }
    spyOn(console, "error").mockImplementation(() => undefined);
    db.listRows.mockResolvedValue({ rows: [], total: 0 });
    account.listIdentities.mockResolvedValue({
      identities: [
        { provider: "microsoft", providerEmail: "Finance.NU.Oslo@biso.no" },
        { provider: "google", providerEmail: "other@gmail.com" },
      ],
    });
  });

  test("returns null without a session", async () => {
    account.get.mockRejectedValue(new Error("no session"));
    teams.list.mockResolvedValue({ teams: [] });
    expect(await getExpenseViewer()).toBeNull();
  });

  test("controller campuses come from active controller rows for the identity emails", async () => {
    signIn();
    db.listRows.mockImplementation(async (_db: string, table: string) => ({
      rows:
        table === "expense_approvers"
          ? [{ campus_id: "1" }, { campus_id: "1" }, { campus_id: "2" }]
          : [],
      total: 0,
    }));

    const viewer = await getExpenseViewer();

    expect(viewer?.controllerCampusIds).toEqual(["1", "2"]);
    expect(viewer?.emails).toEqual(["finance.nu.oslo@biso.no"]);
    // The auth context's own approver lookup also reads this table; pick the
    // controller query.
    const call = controllerRows().find((c) =>
      (c[2] as string[]).join(" ").includes('"role"')
    );
    expect(call).toBeDefined();
    const queries = (call?.[2] as string[]).join(" ");
    expect(queries).toContain("finance.nu.oslo@biso.no");
    expect(queries).toContain("controller");
    expect(queries).toContain('"active"');
    expect(queries).not.toContain("other@gmail.com");
  });

  test("the bare account email is never used", async () => {
    signIn();
    account.listIdentities.mockResolvedValue({ identities: [] });

    const viewer = await getExpenseViewer();

    expect(viewer?.accountEmail).toBe("Bare.Account@biso.no");
    expect(viewer?.emails).toEqual([]);
    expect(viewer?.controllerCampusIds).toEqual([]);
    expect(controllerRows()).toHaveLength(0);
  });

  test("reports global admin from the auth context", async () => {
    signIn(GLOBAL_TEAMS);
    const viewer = await getExpenseViewer();
    expect(viewer?.isGlobalAdmin).toBe(true);
    expect(viewer?.userId).toBe("user-1");
  });
});

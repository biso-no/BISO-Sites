import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";

/** What `createAdminClient()` resolves to; replaced per test. */
let adminClient: Record<string, unknown> = { db: {} };

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => adminClient),
  createSessionClient: mock(async () => ({ db: {} })),
}));

mock.module("server-only", () => ({}));

const { reconcileM365Profile, syncM365Permissions } = await import(
  "./m365-sync"
);

function makeDb() {
  return {
    getRow: mock(),
    createRow: mock(async () => ({})),
    deleteRow: mock(async () => ({})),
  };
}

const NOT_FOUND = async () => {
  await Promise.resolve();
  throw new Error("not found");
};

describe("reconcileM365Profile", () => {
  let db: ReturnType<typeof makeDb>;

  beforeEach(() => {
    db = makeDb();
  });

  test("migrates a Graph-id-keyed profile onto the account id and drops the orphan", async () => {
    db.getRow
      // 1st call: account-id lookup misses
      .mockImplementationOnce(NOT_FOUND)
      // 2nd call: the IT-seeded profile keyed by the Graph id
      .mockImplementationOnce(async () => ({
        $id: "graph-1",
        name: "Ada Lovelace",
        email: "ada@biso.no",
        campus_id: "oslo",
        department_ids: ["dept-1"],
        isActive: true,
      }));

    await reconcileM365Profile(db as never, "account-1", "graph-1");

    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "user",
      "account-1",
      {
        name: "Ada Lovelace",
        email: "ada@biso.no",
        campus_id: "oslo",
        department_ids: ["dept-1"],
        isActive: true,
      },
      ['read("user:account-1")']
    );
    expect(db.deleteRow).toHaveBeenCalledWith("app", "user", "graph-1");
  });

  test("does nothing when an account-id profile already exists", async () => {
    db.getRow.mockImplementationOnce(async () => ({ $id: "account-1" }));

    await reconcileM365Profile(db as never, "account-1", "graph-1");

    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.deleteRow).not.toHaveBeenCalled();
  });

  test("does nothing when no seeded profile exists under the Graph id", async () => {
    db.getRow
      .mockImplementationOnce(NOT_FOUND)
      .mockImplementationOnce(NOT_FOUND);

    await reconcileM365Profile(db as never, "account-1", "graph-1");

    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.deleteRow).not.toHaveBeenCalled();
  });

  test("skips entirely when providerUid equals the account id", async () => {
    await reconcileM365Profile(db as never, "same-id", "same-id");

    expect(db.getRow).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });
});

describe("syncM365Permissions records the user's synced team ids", () => {
  const realFetch = globalThis.fetch;
  let db: { upsertRow: ReturnType<typeof mock> };
  let teams: {
    create: ReturnType<typeof mock>;
    createMembership: ReturnType<typeof mock>;
    deleteMembership: ReturnType<typeof mock>;
  };
  let users: {
    listIdentities: ReturnType<typeof mock>;
    listMemberships: ReturnType<typeof mock>;
  };

  function graphReturns(displayNames: string[]): void {
    globalThis.fetch = mock(
      async () =>
        new Response(
          JSON.stringify({
            value: displayNames.map((displayName, n) => ({
              id: `group-${n}`,
              displayName,
            })),
          }),
          { status: 200 }
        )
    ) as unknown as typeof fetch;
  }

  beforeEach(() => {
    db = { upsertRow: mock(async () => ({})) };
    teams = {
      create: mock(async () => ({})),
      createMembership: mock(async () => ({})),
      deleteMembership: mock(async () => ({})),
    };
    users = {
      listIdentities: mock(async () => ({
        identities: [
          {
            provider: "microsoft",
            providerUid: "user-1",
            providerAccessToken: "token",
          },
        ],
      })),
      listMemberships: mock(async () => ({ memberships: [], total: 0 })),
    };
    adminClient = { db, teams, users };
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    adminClient = { db: {} };
  });

  test("upserts the synced team ids as a service-only row", async () => {
    graphReturns([
      "SG-App-Campus-Oslo",
      "SG-App-Dept-Marketing",
      "Some Other Group",
    ]);

    await syncM365Permissions("user-1");

    expect(db.upsertRow).toHaveBeenCalledTimes(1);
    const [databaseId, tableId, rowId, data, permissions] =
      db.upsertRow.mock.calls[0];
    expect([databaseId, tableId, rowId]).toEqual([
      "app",
      "m365_team_sync",
      "user-1",
    ]);
    expect([...data.team_ids].sort()).toEqual([
      "sg-app-campus-oslo",
      "sg-app-dept-marketing",
    ]);
    expect(new Date(data.synced_at).toISOString()).toBe(data.synced_at);
    expect(permissions).toEqual([]);
  });

  test("records an empty list when the user has no synced groups", async () => {
    graphReturns(["Some Other Group"]);

    await syncM365Permissions("user-1");

    expect(db.upsertRow.mock.calls[0][3].team_ids).toEqual([]);
  });

  test("fails the sync when the record can't be written", async () => {
    graphReturns(["SG-App-Campus-Oslo"]);
    const failure = new Error("write failed");
    db.upsertRow.mockImplementation(async () => {
      await Promise.resolve();
      throw failure;
    });
    const errorLog = spyOn(console, "error").mockImplementation(
      () => undefined
    );

    try {
      await expect(syncM365Permissions("user-1")).rejects.toBe(failure);
      expect(errorLog).toHaveBeenCalled();
    } finally {
      errorLog.mockRestore();
    }
  });

  test("writes nothing without a fresh Microsoft token", async () => {
    users.listIdentities.mockImplementation(async () => ({
      identities: [{ provider: "microsoft", providerUid: "user-1" }],
    }));

    await syncM365Permissions("user-1");

    expect(db.upsertRow).not.toHaveBeenCalled();
  });
});

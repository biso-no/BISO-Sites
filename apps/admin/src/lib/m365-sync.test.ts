import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: {} })),
  createSessionClient: mock(async () => ({ db: {} })),
}));

const { reconcileM365Profile } = await import("./m365-sync");

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
      ['read("user:account-1")', 'update("user:account-1")']
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

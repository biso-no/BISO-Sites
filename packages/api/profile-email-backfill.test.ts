import { describe, expect, it, vi } from "vitest";
import { backfillProfileEmails } from "./profile-email-backfill";

const PAGE = 100;

function fakeDb(rows: Array<{ $id: string; email?: string | null }>) {
  return {
    listRows: vi.fn(({ queries }: { queries: string[] }) => {
      const cursor = queries
        .map((q) => JSON.parse(q))
        .find((q) => q.method === "cursorAfter")?.values[0];
      const start = cursor ? rows.findIndex((r) => r.$id === cursor) + 1 : 0;
      const page = rows.slice(start, start + PAGE);
      return Promise.resolve({ rows: page, total: rows.length });
    }),
    updateRow: vi.fn(async () => ({})),
  };
}

function fakeUsers(accounts: Record<string, string>) {
  return {
    get: vi.fn(({ userId }: { userId: string }) =>
      userId in accounts
        ? Promise.resolve({ email: accounts[userId] })
        : Promise.reject(
            Object.assign(new Error("User not found"), { code: 404 })
          )
    ),
  };
}

describe("backfillProfileEmails", () => {
  it("stamps the account email on rows without one, and leaves the rest alone", async () => {
    const db = fakeDb([
      { $id: "has-email", email: "kept@bi.no" },
      { $id: "null-email", email: null },
      { $id: "blank-email", email: "  " },
      { $id: "missing-key" },
    ]);
    const users = fakeUsers({
      "blank-email": "blank@bi.no",
      "has-email": "different@bi.no",
      "missing-key": "missing@bi.no",
      "null-email": "null@bi.no",
    });

    const report = await backfillProfileEmails(db, users, { apply: true });

    expect(report.checked).toBe(4);
    expect(report.alreadySet).toBe(1);
    expect(report.stamped.sort()).toEqual([
      "blank-email",
      "missing-key",
      "null-email",
    ]);
    expect(db.updateRow).toHaveBeenCalledTimes(3);
    expect(db.updateRow).toHaveBeenCalledWith({
      data: { email: "null@bi.no" },
      databaseId: "app",
      rowId: "null-email",
      tableId: "user",
    });
    // A row that already has an email is never looked up or rewritten.
    expect(users.get).not.toHaveBeenCalledWith({ userId: "has-email" });
  });

  it("writes nothing in a dry run", async () => {
    const db = fakeDb([{ $id: "u1", email: null }]);
    const users = fakeUsers({ u1: "u1@bi.no" });

    const report = await backfillProfileEmails(db, users, { apply: false });

    expect(report.stamped).toEqual(["u1"]);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("skips rows it cannot fill instead of failing the run", async () => {
    const db = fakeDb([
      { $id: "no-account", email: null },
      { $id: "no-account-email", email: null },
      { $id: "too-long", email: null },
    ]);
    const users = fakeUsers({
      "no-account-email": "",
      "too-long": `${"a".repeat(101)}@bi.no`,
    });

    const report = await backfillProfileEmails(db, users, { apply: true });

    expect(report.stamped).toEqual([]);
    expect(report.skipped).toEqual([
      { reason: "no_account", rowId: "no-account" },
      { reason: "no_account_email", rowId: "no-account-email" },
      { reason: "too_long", rowId: "too-long" },
    ]);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("reports a failed write and carries on with the next row", async () => {
    const db = fakeDb([
      { $id: "fails", email: null },
      { $id: "works", email: null },
    ]);
    db.updateRow.mockRejectedValueOnce(new Error("server error"));
    const users = fakeUsers({ fails: "fails@bi.no", works: "works@bi.no" });

    const report = await backfillProfileEmails(db, users, { apply: true });

    expect(report.errors).toEqual([
      { message: "server error", rowId: "fails" },
    ]);
    expect(report.stamped).toEqual(["works"]);
  });

  it("pages through every row", async () => {
    const rows = Array.from({ length: PAGE + 5 }, (_, i) => ({
      $id: `u${i}`,
      email: null,
    }));
    const db = fakeDb(rows);
    const users = fakeUsers(
      Object.fromEntries(rows.map((r) => [r.$id, `${r.$id}@bi.no`]))
    );

    const report = await backfillProfileEmails(db, users, { apply: false });

    expect(report.checked).toBe(PAGE + 5);
    expect(db.listRows).toHaveBeenCalledTimes(2);
  });
});

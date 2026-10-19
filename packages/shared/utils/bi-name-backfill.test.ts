import { describe, expect, it, vi } from "vitest";
import { backfillBiNames } from "./bi-name-backfill";

const PAGE = 100;

function cursorOf(queries: string[]): string | undefined {
  return queries
    .map((q) => JSON.parse(q))
    .find((q) => q.method === "cursorAfter")?.values[0];
}

function page<T extends { $id: string }>(items: T[], queries: string[]): T[] {
  const cursor = cursorOf(queries);
  const start = cursor ? items.findIndex((i) => i.$id === cursor) + 1 : 0;
  return items.slice(start, start + PAGE);
}

function fakeUsers(accounts: Array<{ $id: string; name: string }>) {
  return {
    list: vi.fn(({ queries }: { queries: string[] }) =>
      Promise.resolve({
        total: accounts.length,
        users: page(accounts, queries),
      })
    ),
    updateName: vi.fn(() => Promise.resolve({})),
  };
}

function fakeDb(
  tables: Record<string, Array<{ $id: string; name?: unknown }>>
) {
  return {
    listRows: vi.fn(
      ({ queries, tableId }: { queries: string[]; tableId: string }) =>
        Promise.resolve({
          rows: page(tables[tableId] ?? [], queries),
          total: (tables[tableId] ?? []).length,
        })
    ),
    updateRow: vi.fn(() => Promise.resolve({})),
  };
}

describe("backfillBiNames", () => {
  it("renames BI-formatted accounts, profiles and public profiles, and nothing else", async () => {
    const users = fakeUsers([
      { $id: "student", name: "(Student) Heien, Markus" },
      { $id: "external", name: "Heien, markus (External)" },
      { $id: "typed", name: "Ola Nordmann" },
    ]);
    const db = fakeDb({
      public_profiles: [{ $id: "pp1", name: "Heien, Markus" }],
      user: [
        { $id: "student", name: "(Student) Heien, Markus" },
        { $id: "typed", name: "Ola Nordmann" },
        { $id: "unnamed", name: null },
      ],
    });

    const report = await backfillBiNames(db, users, { apply: true });

    expect(report.accounts.checked).toBe(3);
    expect(report.accounts.renamed).toEqual([
      { from: "(Student) Heien, Markus", id: "student", to: "Markus Heien" },
      { from: "Heien, markus (External)", id: "external", to: "Markus Heien" },
    ]);
    expect(users.updateName).toHaveBeenCalledTimes(2);
    expect(users.updateName).toHaveBeenCalledWith({
      name: "Markus Heien",
      userId: "student",
    });

    expect(report.profiles.checked).toBe(3);
    expect(report.profiles.renamed.map((r) => r.id)).toEqual(["student"]);
    expect(db.updateRow).toHaveBeenCalledWith({
      data: { name: "Markus Heien" },
      databaseId: "app",
      rowId: "student",
      tableId: "user",
    });

    expect(report.publicProfiles.renamed.map((r) => r.id)).toEqual(["pp1"]);
    expect(db.updateRow).toHaveBeenCalledWith({
      data: { name: "Markus Heien" },
      databaseId: "app",
      rowId: "pp1",
      tableId: "public_profiles",
    });
    expect(db.updateRow).toHaveBeenCalledTimes(2);
  });

  it("writes nothing in a dry run", async () => {
    const users = fakeUsers([{ $id: "u1", name: "Heien, Markus" }]);
    const db = fakeDb({ user: [{ $id: "u1", name: "Heien, Markus" }] });

    const report = await backfillBiNames(db, users, { apply: false });

    expect(report.accounts.renamed).toHaveLength(1);
    expect(report.profiles.renamed).toHaveLength(1);
    expect(users.updateName).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("skips a profile row whose new name does not fit the column", async () => {
    const long = `${"Nordmann".repeat(3)}, ${"Ola".repeat(3)}`;
    const db = fakeDb({ user: [{ $id: "long", name: long }] });

    const report = await backfillBiNames(db, fakeUsers([]), { apply: true });

    expect(report.profiles.renamed).toEqual([]);
    expect(report.profiles.skipped).toEqual([
      { id: "long", reason: "too_long" },
    ]);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("reports a failed write and carries on", async () => {
    const users = fakeUsers([
      { $id: "fails", name: "Heien, Markus" },
      { $id: "works", name: "Nordmann, Ola" },
    ]);
    users.updateName.mockRejectedValueOnce(new Error("server error"));

    const report = await backfillBiNames(db(), users, { apply: true });

    expect(report.errors).toEqual([
      { id: "fails", message: "server error", scope: "account" },
    ]);
    expect(report.accounts.renamed.map((r) => r.id)).toEqual(["works"]);

    function db() {
      return fakeDb({});
    }
  });

  it("pages through every account", async () => {
    const accounts = Array.from({ length: PAGE + 3 }, (_, i) => ({
      $id: `u${i}`,
      name: "Ola Nordmann",
    }));
    const users = fakeUsers(accounts);

    const report = await backfillBiNames(fakeDb({}), users, { apply: false });

    expect(report.accounts.checked).toBe(PAGE + 3);
    expect(users.list).toHaveBeenCalledTimes(2);
  });
});

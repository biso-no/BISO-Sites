import { describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import {
  loadTranslationsByLocale,
  restampTranslationReads,
} from "./content-translation-reads";

function fakeDb(pages: { $id: string; $permissions: string[] }[][]) {
  const listRows = mock(() => {
    const rows = pages.shift() ?? [];
    return Promise.resolve({ rows, total: rows.length });
  });
  return { listRows, updateRow: mock(() => Promise.resolve({})) };
}

describe("restampTranslationReads", () => {
  test("replaces read entries and keeps the rest", async () => {
    const db = fakeDb([
      [{ $id: "t1", $permissions: ['read("any")', 'update("team:x")'] }],
    ]);
    await restampTranslationReads(db as never, "news", "n1", "published");
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      "t1",
      {},
      ['update("team:x")', 'read("any")']
    );
  });

  test("drops reads when the parent is not published", async () => {
    const db = fakeDb([[{ $id: "t1", $permissions: ['read("any")'] }]]);
    await restampTranslationReads(db as never, "product", "p1", "draft");
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      "t1",
      {},
      []
    );
  });

  test("pages through every translation", async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({
      $id: `a${i}`,
      $permissions: [],
    }));
    const db = fakeDb([full, [{ $id: "last", $permissions: [] }]]);
    await restampTranslationReads(db as never, "news", "n1", "published");
    expect(db.listRows).toHaveBeenCalledTimes(2);
    expect(db.updateRow).toHaveBeenCalledTimes(101);
  });
});

describe("loadTranslationsByLocale", () => {
  test("asks for one item's translations and keys them by locale", async () => {
    const rows = [
      { $id: "t-en", locale: "en" },
      { $id: "t-no", locale: "no" },
    ];
    const listRows = mock(() => Promise.resolve({ rows, total: rows.length }));
    const byLocale = await loadTranslationsByLocale(
      { listRows } as never,
      "memberBenefit",
      "b1",
      5
    );
    expect(listRows).toHaveBeenCalledWith("app", "content_translations", [
      Query.equal("content_type", "memberBenefit"),
      Query.equal("content_id", "b1"),
      Query.limit(5),
    ]);
    expect([...byLocale.keys()]).toEqual(["en", "no"]);
    expect(byLocale.get("no")?.$id).toBe("t-no");
  });
});

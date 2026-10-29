import { describe, expect, mock, test } from "bun:test";
import { restampTranslationReads } from "./content-translation-reads";

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

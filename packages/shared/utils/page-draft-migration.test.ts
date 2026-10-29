import { describe, expect, it } from "vitest";
import {
  migratePageDrafts,
  type PageDraftMigrationDb,
} from "./page-draft-migration";

type Row = { $id: string } & Record<string, unknown>;

interface Write {
  data: Record<string, unknown>;
  kind: "create" | "update";
  rowId: string;
  tableId: string;
}

function limitAndCursor(queries: string[] | undefined) {
  let limit = 25;
  let after: string | undefined;
  for (const q of queries ?? []) {
    const parsed = JSON.parse(q) as { method: string; values: unknown[] };
    if (parsed.method === "limit") {
      limit = parsed.values[0] as number;
    }
    if (parsed.method === "cursorAfter") {
      after = parsed.values[0] as string;
    }
  }
  return { limit, after };
}

function makeDb(
  tables: Record<string, Row[]>,
  options: {
    failCreate?: string[];
    failList?: (tableId: string, callNo: number) => boolean;
  } = {}
) {
  const calls: Record<string, number> = {};
  const writes: Write[] = [];
  const db: PageDraftMigrationDb = {
    listRows: (params) => {
      calls[params.tableId] = (calls[params.tableId] ?? 0) + 1;
      if (options.failList?.(params.tableId, calls[params.tableId] as number)) {
        return Promise.reject(new Error("list failed"));
      }
      const rows = tables[params.tableId] ?? [];
      const { limit, after } = limitAndCursor(params.queries);
      const start = after ? rows.findIndex((r) => r.$id === after) + 1 : 0;
      return Promise.resolve({ rows: rows.slice(start, start + limit) });
    },
    createRow: (params) => {
      if (options.failCreate?.includes(params.rowId)) {
        return Promise.reject(new Error("create failed"));
      }
      writes.push({
        kind: "create",
        tableId: params.tableId,
        rowId: params.rowId,
        data: params.data,
      });
      return Promise.resolve({});
    },
    updateRow: (params) => {
      writes.push({
        kind: "update",
        tableId: params.tableId,
        rowId: params.rowId,
        data: params.data ?? {},
      });
      return Promise.resolve({});
    },
  };
  return { db, writes };
}

const doc = (title?: string, description?: string) =>
  JSON.stringify({ version: 2, sections: [], meta: { title, description } });

function translation(id: string, extra: Record<string, unknown> = {}): Row {
  return {
    $id: id,
    page_id: "p1",
    locale: "no",
    title: "Title",
    description: "Desc",
    is_published: false,
    published_doc: null,
    draft_doc: null,
    puck_document: null,
    draft_document: null,
    ...extra,
  };
}

const CLEARED = { draft_doc: null, puck_document: null, draft_document: null };

describe("migratePageDrafts", () => {
  it("dry run plans but never writes", async () => {
    const { db, writes } = makeDb({
      page_translations: [translation("t1", { draft_doc: "{}" })],
    });
    const report = await migratePageDrafts(db, { apply: false });
    expect(writes).toEqual([]);
    expect(report.created).toEqual(["t1"]);
    expect(report.cleared).toEqual(["t1"]);
  });

  it("creates the missing draft, then clears the columns", async () => {
    const { db, writes } = makeDb({
      page_translations: [translation("t1", { draft_doc: "{}" })],
    });
    await migratePageDrafts(db, { apply: true });
    expect(writes).toEqual([
      {
        kind: "create",
        tableId: "page_drafts",
        rowId: "t1",
        data: {
          page_id: "p1",
          locale: "no",
          draft_doc: "{}",
          title: "Title",
          description: "Desc",
        },
      },
      {
        kind: "update",
        tableId: "page_translations",
        rowId: "t1",
        data: CLEARED,
      },
    ]);
  });

  it("does not overwrite an existing draft but still clears the columns", async () => {
    const { db, writes } = makeDb({
      page_drafts: [{ $id: "t1" }],
      page_translations: [translation("t1", { puck_document: "{}" })],
    });
    const report = await migratePageDrafts(db, { apply: true });
    expect(report.created).toEqual([]);
    expect(writes).toEqual([
      {
        kind: "update",
        tableId: "page_translations",
        rowId: "t1",
        data: CLEARED,
      },
    ]);
  });

  it("leaves the columns when the draft create fails and continues", async () => {
    const { db, writes } = makeDb(
      {
        page_translations: [
          translation("t1", { draft_doc: "{}" }),
          translation("t2", { draft_document: "{}", draft_doc: "{}" }),
        ],
      },
      { failCreate: ["t1"] }
    );
    const report = await migratePageDrafts(db, { apply: true });
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]?.rowId).toBe("t1");
    expect(writes.map((w) => `${w.kind}:${w.rowId}`)).toEqual([
      "create:t2",
      "update:t2",
    ]);
  });

  it("writes nothing when any listing fails", async () => {
    const { db, writes } = makeDb(
      { page_translations: [translation("t1", { draft_doc: "{}" })] },
      { failList: (tableId) => tableId === "page_drafts" }
    );
    const report = await migratePageDrafts(db, { apply: true });
    expect(report.errors.length).toBeGreaterThan(0);
    expect(writes).toEqual([]);
  });

  it("writes nothing when the translation listing fails midway", async () => {
    const rows = Array.from({ length: 150 }, (_, i) =>
      translation(`t${i}`, { draft_doc: "{}" })
    );
    const { db, writes } = makeDb(
      { page_translations: rows },
      { failList: (tableId, n) => tableId === "page_translations" && n === 2 }
    );
    const report = await migratePageDrafts(db, { apply: true });
    expect(report.errors.length).toBeGreaterThan(0);
    expect(writes).toEqual([]);
  });

  it("paginates past 100 rows", async () => {
    const rows = Array.from({ length: 230 }, (_, i) =>
      translation(`t${i}`, { draft_doc: "{}" })
    );
    const drafts = Array.from({ length: 120 }, (_, i) => ({ $id: `t${i}` }));
    const { db } = makeDb({ page_translations: rows, page_drafts: drafts });
    const report = await migratePageDrafts(db, { apply: false });
    expect(report.scanned).toBe(230);
    expect(report.created).toHaveLength(110);
    expect(report.cleared).toHaveLength(230);
  });

  it("restores a published row's title and moves the current one to the draft", async () => {
    const { db, writes } = makeDb({
      page_translations: [
        translation("t1", {
          is_published: true,
          published_doc: doc("Published title", "Published desc"),
          title: "Unpublished title",
          description: "Unpublished desc",
          draft_doc: "{}",
        }),
      ],
    });
    const report = await migratePageDrafts(db, { apply: true });
    expect(report.restoredTitles).toEqual(["t1"]);
    expect(writes[0]?.data).toMatchObject({
      title: "Unpublished title",
      description: "Unpublished desc",
    });
    expect(writes[1]?.data).toEqual({
      ...CLEARED,
      title: "Published title",
      description: "Published desc",
    });
  });

  it("keeps an existing draft's text and still restores the row", async () => {
    const { db, writes } = makeDb({
      page_drafts: [{ $id: "t1" }],
      page_translations: [
        translation("t1", {
          is_published: true,
          published_doc: doc("Published title"),
          title: "Other",
        }),
      ],
    });
    const report = await migratePageDrafts(db, { apply: true });
    expect(report.restoredTitles).toEqual(["t1"]);
    expect(writes).toEqual([
      {
        kind: "update",
        tableId: "page_translations",
        rowId: "t1",
        data: { title: "Published title" },
      },
    ]);
  });

  it("never changes the title of an unpublished row", async () => {
    const { db, writes } = makeDb({
      page_translations: [
        translation("t1", {
          is_published: false,
          published_doc: doc("Old published"),
          draft_doc: "{}",
        }),
      ],
    });
    const report = await migratePageDrafts(db, { apply: true });
    expect(report.restoredTitles).toEqual([]);
    expect(writes[1]?.data).toEqual(CLEARED);
  });

  it("keeps the title when the published doc has none", async () => {
    const { db, writes } = makeDb({
      page_translations: [
        translation("t1", {
          is_published: true,
          published_doc: doc(undefined, ""),
          draft_doc: "{}",
        }),
      ],
    });
    const report = await migratePageDrafts(db, { apply: true });
    expect(report.restoredTitles).toEqual([]);
    expect(writes[1]?.data).toEqual(CLEARED);
  });

  it("plans nothing for rows that are already migrated", async () => {
    const { db, writes } = makeDb({
      page_translations: [
        translation("t1", {
          is_published: true,
          published_doc: doc("Title", "Desc"),
        }),
      ],
    });
    const report = await migratePageDrafts(db, { apply: true });
    expect(writes).toEqual([]);
    expect(report.cleared).toEqual([]);
  });
});

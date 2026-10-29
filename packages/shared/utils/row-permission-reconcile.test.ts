import { describe, expect, it } from "vitest";
import {
  desiredReadPermissions,
  mergeReadPermissions,
  type PageParent,
  type ReconcileDb,
  reconcileRowPermissions,
} from "./row-permission-reconcile";

const ANY = 'read("any")';
const MEMBERS = 'read("team:biso-members")';
const UPDATE_X = 'update("team:x")';

const pages = new Map<string, PageParent>([
  ["pub", { status: "published", visibility: "public" }],
  ["mem", { status: "published", visibility: "authenticated" }],
  ["arc", { status: "archived", visibility: "public" }],
]);

describe("desiredReadPermissions", () => {
  it("makes published benefits public and drafts private", () => {
    expect(
      desiredReadPermissions("campus_benefits", { status: "published" }, pages)
    ).toEqual([ANY]);
    expect(
      desiredReadPermissions("campus_benefits", { status: "draft" }, pages)
    ).toEqual([]);
  });

  it("gives published members pages a members-team read", () => {
    expect(
      desiredReadPermissions(
        "pages",
        { status: "published", visibility: "authenticated" },
        pages
      )
    ).toEqual([MEMBERS]);
  });

  it("gives archived pages no read", () => {
    expect(
      desiredReadPermissions(
        "pages",
        { status: "archived", visibility: "public" },
        pages
      )
    ).toEqual([]);
  });

  it("follows the parent page for translations", () => {
    const translation = (isPublished: boolean, pageId: string) =>
      desiredReadPermissions(
        "page_translations",
        { is_published: isPublished, page_id: pageId },
        pages
      );
    expect(translation(true, "arc")).toEqual([]);
    expect(translation(true, "pub")).toEqual([ANY]);
    expect(translation(true, "mem")).toEqual([MEMBERS]);
    expect(translation(false, "pub")).toEqual([]);
    expect(translation(true, "nope")).toEqual([]);
  });

  it("keeps members-only published events world-readable", () => {
    expect(
      desiredReadPermissions(
        "events",
        { status: "published", member_only: true },
        pages
      )
    ).toEqual([ANY]);
    expect(
      desiredReadPermissions("events", { status: "draft" }, pages)
    ).toEqual([]);
  });
});

describe("mergeReadPermissions", () => {
  it("drops old reads and keeps other permissions", () => {
    expect(mergeReadPermissions([ANY, UPDATE_X], [])).toEqual([UPDATE_X]);
    expect(mergeReadPermissions([ANY, UPDATE_X, UPDATE_X], [MEMBERS])).toEqual([
      MEMBERS,
      UPDATE_X,
    ]);
  });
});

type Row = { $id: string; $permissions: string[] } & Record<string, unknown>;
interface Update {
  permissions: string[];
  rowId: string;
  tableId: string;
}

function readQueryOptions(queries: string[] | undefined) {
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
  failIds: string[] = [],
  failList: (tableId: string, callNo: number) => boolean = () => false
) {
  const calls: Record<string, number> = {};
  const updates: Update[] = [];
  const db = {
    listRows: (params: { tableId: string; queries?: string[] }) => {
      calls[params.tableId] = (calls[params.tableId] ?? 0) + 1;
      if (failList(params.tableId, calls[params.tableId] as number)) {
        return Promise.reject(new Error("list failed"));
      }
      const rows = tables[params.tableId] ?? [];
      const { limit, after } = readQueryOptions(params.queries);
      const start = after ? rows.findIndex((r) => r.$id === after) + 1 : 0;
      return Promise.resolve({
        rows: rows.slice(start, start + limit),
        total: rows.length,
      });
    },
    updateRow: (params: {
      tableId: string;
      rowId: string;
      permissions?: string[];
    }) => {
      if (failIds.includes(params.rowId)) {
        return Promise.reject(new Error("boom"));
      }
      updates.push({
        tableId: params.tableId,
        rowId: params.rowId,
        permissions: params.permissions ?? [],
      });
      return Promise.resolve({});
    },
  } as unknown as ReconcileDb;
  return { db, updates };
}

function fixture(): Record<string, Row[]> {
  const pageRows: Row[] = Array.from({ length: 150 }, (_, i) => ({
    $id: `p${i}`,
    $permissions: [ANY],
    status: "published",
    visibility: "public",
  }));
  // Only reachable through pagination: archived but still public.
  pageRows[149] = { ...pageRows[149], status: "archived" } as Row;
  return {
    pages: pageRows,
    campus_benefits: [
      { $id: "b1", $permissions: [ANY], status: "draft" },
      { $id: "b2", $permissions: [ANY], status: "published" },
    ],
    page_translations: [
      { $id: "t1", $permissions: [], is_published: true, page_id: "p0" },
      {
        $id: "t2",
        $permissions: [ANY, UPDATE_X],
        is_published: true,
        page_id: "p149",
      },
    ],
    events: [{ $id: "e1", $permissions: [], status: "published" }],
  };
}

describe("reconcileRowPermissions", () => {
  it("never writes in dry run", async () => {
    const { db, updates } = makeDb(fixture());
    const report = await reconcileRowPermissions(db, { apply: false });
    expect(updates).toEqual([]);
    expect(report.scanned.pages).toBe(150);
    expect(report.changes.map((c) => c.rowId).sort()).toEqual(
      ["b1", "e1", "p149", "t1", "t2"].sort()
    );
    expect(report.errors).toEqual([]);
  });

  it("writes only differing rows and keeps non-read permissions", async () => {
    const { db, updates } = makeDb(fixture());
    await reconcileRowPermissions(db, { apply: true });
    expect(updates).toHaveLength(5);
    expect(updates.find((u) => u.rowId === "t2")?.permissions).toEqual([
      UPDATE_X,
    ]);
    expect(updates.find((u) => u.rowId === "p149")?.permissions).toEqual([]);
    expect(updates.find((u) => u.rowId === "e1")?.permissions).toEqual([ANY]);
    expect(updates.some((u) => u.rowId === "b2")).toBe(false);
    expect(updates.some((u) => u.rowId === "p0")).toBe(false);
  });

  it("records a failed update and keeps going", async () => {
    const { db, updates } = makeDb(fixture(), ["b1"]);
    const report = await reconcileRowPermissions(db, { apply: true });
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toMatchObject({
      tableId: "campus_benefits",
      rowId: "b1",
    });
    expect(updates).toHaveLength(4);
  });

  it("writes nothing when a later pages listing fails", async () => {
    const { db, updates } = makeDb(
      fixture(),
      [],
      (tableId, callNo) => tableId === "pages" && callNo === 2
    );
    const report = await reconcileRowPermissions(db, { apply: true });
    expect(updates).toEqual([]);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]?.tableId).toBe("pages");
  });

  it("writes nothing on any table when the events scan fails", async () => {
    const { db, updates } = makeDb(
      fixture(),
      [],
      (tableId) => tableId === "events"
    );
    const report = await reconcileRowPermissions(db, { apply: true });
    expect(updates).toEqual([]);
    expect(report.errors.map((e) => e.tableId)).toEqual(["events"]);
  });

  it("skips translations with an unknown parent page", async () => {
    const tables = fixture();
    tables.page_translations = [
      { $id: "orphan", $permissions: [ANY], is_published: true, page_id: "zz" },
    ];
    const { db, updates } = makeDb(tables);
    const report = await reconcileRowPermissions(db, { apply: true });
    expect(report.skipped).toEqual([
      {
        tableId: "page_translations",
        rowId: "orphan",
        reason: "parent page not found",
      },
    ]);
    expect(report.changes.some((c) => c.rowId === "orphan")).toBe(false);
    expect(updates.some((u) => u.rowId === "orphan")).toBe(false);
  });
});

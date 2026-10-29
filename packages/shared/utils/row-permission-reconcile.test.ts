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

const OU = 'read("team:sg-app-dept-operationsunit")';
const HR = 'read("team:sg-app-dept-hr")';
const CREATE_X = 'create("team:x")';

function translationFixture(translations: Row[]): Record<string, Row[]> {
  return {
    pages: [],
    page_translations: [],
    campus_benefits: [
      { $id: "ben-pub", $permissions: [ANY], status: "published" },
      { $id: "ben-draft", $permissions: [], status: "draft" },
    ],
    events: [
      { $id: "ev-pub", $permissions: [ANY], status: "published" },
      { $id: "ev-draft", $permissions: [], status: "draft" },
    ],
    news: [
      { $id: "n-pub", $permissions: [], status: "published" },
      { $id: "n-draft", $permissions: [], status: "draft" },
    ],
    webshop_products: [
      { $id: "pr-pub", $permissions: [], status: "published" },
      { $id: "pr-draft", $permissions: [], status: "draft" },
    ],
    jobs: [
      { $id: "j-pub", $permissions: [], status: "published" },
      { $id: "j-draft", $permissions: [], status: "draft" },
    ],
    content_translations: translations,
  };
}

const tr = (
  id: string,
  contentType: string,
  contentId: string,
  permissions: string[] = []
): Row => ({
  $id: id,
  $permissions: permissions,
  content_type: contentType,
  content_id: contentId,
});

describe("content_translations", () => {
  it("applies the read rule per content type", async () => {
    const { db, updates } = makeDb(
      translationFixture([
        tr("t-ev", "event", "ev-pub"),
        tr("t-ev-d", "event", "ev-draft", [ANY]),
        tr("t-ben", "memberBenefit", "ben-pub"),
        tr("t-ben-d", "memberBenefit", "ben-draft", [ANY]),
        tr("t-news", "news", "n-pub"),
        tr("t-prod", "product", "pr-pub"),
        tr("t-dept", "department", "any-dept"),
      ])
    );
    await reconcileRowPermissions(db, { apply: true });
    const perms = (id: string) =>
      updates.find((u) => u.rowId === id)?.permissions;
    expect(perms("t-ev")).toEqual([ANY]);
    expect(perms("t-ev-d")).toEqual([]);
    expect(perms("t-ben")).toEqual([ANY]);
    expect(perms("t-ben-d")).toEqual([]);
    expect(perms("t-news")).toEqual([ANY]);
    expect(perms("t-prod")).toEqual([ANY]);
    expect(perms("t-dept")).toEqual([ANY]);
  });

  it("gives job translations staff reads, and public read only when published", async () => {
    const { db, updates } = makeDb(
      translationFixture([
        tr("t-j-pub", "job", "j-pub"),
        tr("t-j-draft", "job", "j-draft", [ANY]),
      ])
    );
    await reconcileRowPermissions(db, { apply: true });
    const pub = updates.find((u) => u.rowId === "t-j-pub")?.permissions ?? [];
    const draft =
      updates.find((u) => u.rowId === "t-j-draft")?.permissions ?? [];
    expect([...pub].sort()).toEqual([ANY, HR, OU].sort());
    expect([...draft].sort()).toEqual([HR, OU].sort());
  });

  it("strips public read from a news translation of a draft", async () => {
    const { db, updates } = makeDb(
      translationFixture([tr("t-n", "news", "n-draft", [ANY])])
    );
    await reconcileRowPermissions(db, { apply: true });
    expect(updates).toEqual([
      { tableId: "content_translations", rowId: "t-n", permissions: [] },
    ]);
  });

  it("skips translations with a missing parent, page or unknown type", async () => {
    const { db, updates } = makeDb(
      translationFixture([
        tr("t-miss", "news", "gone", [ANY]),
        tr("t-page", "page", "p1", [ANY]),
        tr("t-odd", "mystery", "x", [ANY]),
      ])
    );
    const report = await reconcileRowPermissions(db, { apply: true });
    expect(report.skipped.map((s) => s.rowId)).toEqual([
      "t-miss",
      "t-page",
      "t-odd",
    ]);
    expect(updates).toEqual([]);
  });

  it("keeps non-read permissions", async () => {
    const { db, updates } = makeDb(
      translationFixture([
        tr("t-keep", "news", "n-draft", [ANY, UPDATE_X, CREATE_X]),
      ])
    );
    await reconcileRowPermissions(db, { apply: true });
    expect(updates[0]?.permissions.sort()).toEqual([CREATE_X, UPDATE_X]);
  });

  it.each([
    "news",
    "webshop_products",
    "jobs",
  ])("writes nothing when the %s scan fails", async (failing) => {
    const { db, updates } = makeDb(
      translationFixture([tr("t-n", "news", "n-draft", [ANY])]),
      [],
      (tableId) => tableId === failing
    );
    const report = await reconcileRowPermissions(db, { apply: true });
    expect(updates).toEqual([]);
    expect(report.errors.map((e) => e.tableId)).toContain(failing);
  });
});

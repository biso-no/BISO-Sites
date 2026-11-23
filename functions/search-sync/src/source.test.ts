import { describe, expect, it } from "bun:test";
import type { MapContext } from "@repo/shared/search/entries/common";
import type { SearchType } from "@repo/shared/search/types";
import { resolveTargets } from "./resolve";
import { type AdminDb, appwriteSource, departmentNames } from "./source";
import { syncTargets } from "./sync";
import type { IndexWriter } from "./writer";

type Row = Record<string, unknown> & { $id: string };
type Tables = Record<string, Row[]>;

interface ParsedQuery {
  attribute?: string;
  method: string;
  values?: unknown[];
}

interface Call {
  queries: ParsedQuery[];
  rowId?: string;
  tableId: string;
}

const DEFAULT_LIMIT = 25;

/** Appwrite's collation matches strings case-insensitively. */
function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === "string" && typeof b === "string") {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

function notFound(type: string) {
  return Object.assign(new Error(type), { code: 404, type });
}

/** An in-memory TablesDB that understands equal, cursorAfter and limit. */
function fakeDb(tables: Tables) {
  const calls: Call[] = [];
  const db = {
    getRow: (params: {
      queries?: string[];
      rowId: string;
      tableId: string;
    }) => {
      const queries = (params.queries ?? []).map(
        (q) => JSON.parse(q) as ParsedQuery
      );
      calls.push({ queries, rowId: params.rowId, tableId: params.tableId });
      const table = tables[params.tableId];
      if (!table) {
        return Promise.reject(notFound("table_not_found"));
      }
      const row = table.find((r) => r.$id === params.rowId);
      return row
        ? Promise.resolve(row)
        : Promise.reject(notFound("row_not_found"));
    },
    listRows: (params: { queries?: string[]; tableId: string }) => {
      const queries = (params.queries ?? []).map(
        (q) => JSON.parse(q) as ParsedQuery
      );
      calls.push({ queries, tableId: params.tableId });
      let rows = tables[params.tableId] ?? [];
      for (const q of queries) {
        if (q.method === "equal") {
          const attribute = q.attribute ?? "";
          rows = rows.filter((r) =>
            (q.values ?? []).some((v) => sameValue(r[attribute], v))
          );
        }
      }
      const cursor = queries.find((q) => q.method === "cursorAfter")
        ?.values?.[0];
      if (cursor !== undefined) {
        rows = rows.slice(rows.findIndex((r) => r.$id === cursor) + 1);
      }
      const limit = queries.find((q) => q.method === "limit")?.values?.[0];
      rows = rows.slice(0, typeof limit === "number" ? limit : DEFAULT_LIMIT);
      return Promise.resolve({ rows, total: rows.length });
    },
  };
  return { calls, db: db as unknown as AdminDb };
}

const ctx: MapContext = {
  departmentName: () => null,
  now: new Date("2026-11-23T00:00:00Z"),
  syncedAt: 1_700_000_000_000,
};

const validDoc = JSON.stringify({
  meta: {},
  sections: [{ blocks: [{ text: "<p>Pakkeliste</p>", type: "text" }] }],
  version: 2,
});

function translation(overrides: Record<string, unknown> = {}) {
  return {
    $id: "t-no",
    description: "<p>Beskrivelse</p>",
    draft_doc: '{"secret":"draft"}',
    is_published: true,
    locale: "no",
    published_doc: validDoc,
    title: "Tittel",
    ...overrides,
  };
}

function page(
  $id: string,
  slug: string,
  overrides: Record<string, unknown> = {}
): Row {
  return {
    $id,
    campus_id: null,
    department_id: null,
    slug,
    status: "published",
    translation_refs: [translation()],
    visibility: "public",
    ...overrides,
  };
}

function department(
  $id: string,
  Name: string,
  slug: string,
  campus_id: string,
  active: boolean | null = true
): Row {
  return { $id, active, campus_id, hero: null, logo: null, Name, slug };
}

const departments: Row[] = [
  department("d1", "OSL Fadderullan", "fadderullan", "1"),
  department("dwg", "Winter Games", "wintergames", "5"),
  department("ddrift", "Drift Oslo", "drift-oslo", "1"),
  department("dold", "OSL Old", "old", "1", false),
];

function source(tables: Tables, names: Record<string, string> = {}) {
  const asked: (string | null | undefined)[] = [];
  const fake = fakeDb({ departments, ...tables });
  const src = appwriteSource(fake.db, {
    departmentName: (id) => {
      asked.push(id);
      return Promise.resolve(id ? (names[id] ?? null) : null);
    },
  });
  return { asked, calls: fake.calls, src };
}

const PAGE_SELECT = [
  "$id",
  "slug",
  "status",
  "visibility",
  "department_id",
  "campus_id",
  "translation_refs.$id",
  "translation_refs.locale",
  "translation_refs.is_published",
  "translation_refs.published_at",
  "translation_refs.published_doc",
  "translation_refs.title",
  "translation_refs.description",
];

describe("appwriteSource.load: content", () => {
  const event: Row = {
    $id: "e1",
    campus_id: "1",
    category: null,
    collection_id: null,
    cover_pattern: null,
    department_id: "d1",
    end_date: null,
    image: null,
    is_collection: false,
    location: "Aula",
    member_only: false,
    member_price: null,
    price: 100,
    pricing_mode: "paid",
    slug: "vinterleker",
    start_date: "2027-02-12T09:00:00.000Z",
    status: "published",
    tags: null,
  };
  const eventTranslation: Row = {
    $id: "ct1",
    additional_fields: null,
    content_id: "e1",
    content_type: "event",
    description: "<p>Tre dager</p>",
    locale: "no",
    short_description: null,
    title: "Vinterleker",
  };

  it("maps an event with its translations and department name", async () => {
    const { asked, calls, src } = source(
      { content_translations: [eventTranslation], events: [event] },
      { d1: "Fadderullan" }
    );
    const item = await src.load({ id: "e1", type: "event" }, ctx);
    expect(item.related).toEqual([]);
    expect(item.entries.map((e) => [e.locale, e.text_locale])).toEqual([
      ["no", "no"],
      ["en", "no"],
    ]);
    expect(item.entries[0]?.department).toBe("Fadderullan");
    expect(asked).toEqual(["d1"]);
    const translationRead = calls.find(
      (c) => c.tableId === "content_translations"
    );
    expect(translationRead?.queries).toEqual([
      { attribute: "content_type", method: "equal", values: ["event"] },
      { attribute: "content_id", method: "equal", values: ["e1"] },
      { method: "limit", values: [10] },
    ]);
  });

  it("gives no entries for a row that is gone", async () => {
    const { src } = source({ content_translations: [], events: [] });
    expect(await src.load({ id: "e1", type: "event" }, ctx)).toEqual({
      entries: [],
      related: [],
    });
  });

  it("rethrows a 404 that is not a missing row", async () => {
    const { src } = source({});
    await expect(src.load({ id: "j1", type: "job" }, ctx)).rejects.toThrow(
      "table_not_found"
    );
  });

  it("reads a product's department from departmentId", async () => {
    const product: Row = {
      $id: "w1",
      campus_id: null,
      category: null,
      cover_pattern: null,
      departmentId: "d1",
      image: null,
      images: null,
      inventory_mode: "unlimited",
      member_only: false,
      member_price: null,
      regular_price: 250,
      slug: "genser",
      status: "published",
      stock: null,
      tags: null,
      unlisted: false,
    };
    const { asked, src } = source(
      {
        content_translations: [
          { ...eventTranslation, content_id: "w1", content_type: "product" },
        ],
        webshop_products: [product],
      },
      { d1: "Fadderullan" }
    );
    const item = await src.load({ id: "w1", type: "product" }, ctx);
    expect(asked).toEqual(["d1"]);
    expect(item.entries[0]?.department).toBe("Fadderullan");
  });

  it("maps a published document", async () => {
    const { src } = source({
      documents: [
        {
          $id: "doc1",
          campus_id: null,
          category: "national-statutes",
          description: "Vedtektene",
          language: "no",
          scope: "national",
          status: "published",
          title: "Vedtekter",
        },
      ],
    });
    const item = await src.load({ id: "doc1", type: "document" }, ctx);
    expect(item.entries.map((e) => e.url)).toEqual([
      "/api/documents/doc1/download",
      "/api/documents/doc1/download",
    ]);
  });
});

describe("appwriteSource.load: pages", () => {
  it("reads only published page fields and maps a standalone page", async () => {
    const { calls, src } = source({ pages: [page("p1", "om-oss")] });
    const item = await src.load({ id: "p1", type: "page" }, ctx);
    expect(item.entries.map((e) => [e.url, e.locale])).toEqual([
      ["/om-oss", "no"],
    ]);
    expect(item.codedSkip).toBeUndefined();
    const read = calls.find((c) => c.tableId === "pages");
    expect(read?.queries).toContainEqual({
      method: "select",
      values: PAGE_SELECT,
    });
    expect(read?.queries).toContainEqual({
      attribute: "$id",
      method: "equal",
      values: ["p1"],
    });
  });

  it("gives no entries for a missing or reserved page", async () => {
    const { src } = source({ pages: [page("p2", "units/oslo")] });
    expect(await src.load({ id: "gone", type: "page" }, ctx)).toEqual({
      entries: [],
      related: [],
    });
    expect(await src.load({ id: "p2", type: "page" }, ctx)).toEqual({
      entries: [],
      related: [],
    });
  });

  it("hands a unit page to its unit", async () => {
    const { src } = source({
      pages: [
        page("pu", "units/oslo/fadderullan", { department_id: "d1" }),
        page("pn", "units/oslo/ghost"),
      ],
    });
    expect(await src.load({ id: "pu", type: "page" }, ctx)).toEqual({
      entries: [],
      related: [{ id: "d1", type: "unit" }],
    });
    expect(await src.load({ id: "pn", type: "page" }, ctx)).toEqual({
      entries: [],
      related: [],
    });
  });

  it("indexes a sub-page bound to its public, active unit", async () => {
    const { src } = source({
      pages: [
        page("ps", "units/oslo/fadderullan/program", { department_id: "d1" }),
      ],
    });
    const item = await src.load({ id: "ps", type: "page" }, ctx);
    expect(item.entries.map((e) => e.url)).toEqual([
      "/units/oslo/fadderullan/program",
    ]);
  });

  it("indexes a page only in the locales whose own translation is published", async () => {
    const { src } = source({
      pages: [
        page("p1", "om-oss", {
          translation_refs: [
            translation(),
            translation({ $id: "t-en", is_published: false, locale: "en" }),
          ],
        }),
        page("p2", "about", {
          translation_refs: [
            translation(),
            translation({ $id: "t-en", locale: "en", title: "About" }),
          ],
        }),
      ],
    });
    const noOnly = await src.load({ id: "p1", type: "page" }, ctx);
    expect(noOnly.entries.map((e) => [e.locale, e.text_locale])).toEqual([
      ["no", "no"],
    ]);
    const both = await src.load({ id: "p2", type: "page" }, ctx);
    expect(both.entries.map((e) => [e.locale, e.title])).toEqual([
      ["no", "Tittel"],
      ["en", "About"],
    ]);
  });

  it("skips a sub-page whose unit does not own it or is not public", async () => {
    const { src } = source({
      pages: [
        page("wrong", "units/oslo/fadderullan/program", {
          department_id: "dwg",
        }),
        page("none", "units/oslo/fadderullan/info"),
        page("drift", "units/oslo/drift-oslo/info", {
          department_id: "ddrift",
        }),
        page("old", "units/oslo/old/info", { department_id: "dold" }),
        page("nounit", "units/oslo/ghost/info", { department_id: "d1" }),
        page("case", "units/Oslo/Fadderullan/info", { department_id: "d1" }),
      ],
    });
    for (const id of ["wrong", "none", "drift", "old", "nounit", "case"]) {
      const item = await src.load({ id, type: "page" }, ctx);
      expect({ entries: item.entries, id }).toEqual({ entries: [], id });
    }
  });

  it("lets a servable hub project page replace its coded entry", async () => {
    const { src } = source({
      pages: [
        page("pf", "projects/fadderullan", {
          translation_refs: [
            translation(),
            translation({ $id: "t-en", locale: "en" }),
          ],
        }),
      ],
    });
    const item = await src.load({ id: "pf", type: "page" }, ctx);
    expect(item.entries.map((e) => [e.url, e.locale])).toEqual([
      ["/projects/fadderullan", "no"],
      ["/projects/fadderullan", "en"],
    ]);
    expect(item.codedSkip).toEqual({
      path: "/projects/fadderullan",
      skipIn: new Set(["no", "en"]),
    });
    expect(item.related).toEqual([]);
  });

  it("replaces the coded hub only in the locale the page is published in", async () => {
    const { src } = source({ pages: [page("pf", "projects/fadderullan")] });
    const item = await src.load({ id: "pf", type: "page" }, ctx);
    expect(item.entries.map((e) => e.locale)).toEqual(["no"]);
    expect(item.codedSkip).toEqual({
      path: "/projects/fadderullan",
      skipIn: new Set(["no"]),
    });
  });

  it("decides the coded hub from every row at the address, not the one loaded", async () => {
    // A stray row at the project address must not bring back the coded hub
    // while the genuine page still serves it.
    const { src } = source({
      pages: [
        page("pf", "projects/fadderullan"),
        page("stray", "projects/fadderullan", { department_id: "d1" }),
      ],
    });
    const item = await src.load({ id: "stray", type: "page" }, ctx);
    expect(item.entries).toEqual([]);
    expect(item.codedSkip).toEqual({
      path: "/projects/fadderullan",
      skipIn: new Set(["no"]),
    });
  });

  it("keeps the coded entry when a project page is not servable", async () => {
    const { src } = source({
      pages: [
        page("bound", "projects/fadderullan", { department_id: "d1" }),
        page("empty", "projects/karrieredagene", {
          translation_refs: [translation({ published_doc: "" })],
        }),
        page("draft", "projects/bergensbanelopet", { status: "draft" }),
        page("accent", "projécts/fadderullan"),
        page("members", "projects/fadderullan", {
          visibility: "authenticated",
        }),
      ],
    });
    const expected = {
      accent: "/projects/fadderullan",
      members: "/projects/fadderullan",
      bound: "/projects/fadderullan",
      draft: "/projects/bergensbanelopet",
      empty: "/projects/karrieredagene",
    };
    for (const [id, path] of Object.entries(expected)) {
      const item = await src.load({ id, type: "page" }, ctx);
      expect({ entries: item.entries, id, skip: item.codedSkip }).toEqual({
        entries: [],
        id,
        skip: { path, skipIn: new Set() },
      });
    }
  });

  it("binds a national project page to its national unit", async () => {
    const { src } = source({
      pages: [page("pw", "projects/winter-games", { department_id: "dwg" })],
    });
    const item = await src.load({ id: "pw", type: "page" }, ctx);
    expect(item.entries).toHaveLength(1);
    expect(item.codedSkip).toEqual({
      path: "/projects/winter-games",
      skipIn: new Set(["no"]),
    });
    expect(item.related).toEqual([{ id: "dwg", type: "unit" }]);
  });

  it("refuses a national project page bound to another unit", async () => {
    const { src } = source({
      pages: [page("pw", "projects/winter-games", { department_id: "d1" })],
    });
    const item = await src.load({ id: "pw", type: "page" }, ctx);
    expect(item.entries).toEqual([]);
    expect(item.codedSkip).toEqual({
      path: "/projects/winter-games",
      skipIn: new Set(),
    });
    // The national unit is re-synced so it can take its URL back.
    expect(item.related).toEqual([{ id: "dwg", type: "unit" }]);
  });
});

describe("appwriteSource.servableProjectPaths", () => {
  it("applies the same servable rule as load, per locale", async () => {
    const { src } = source({
      pages: [
        page("pf", "projects/fadderullan", {
          translation_refs: [
            translation(),
            translation({ $id: "t-en", locale: "en" }),
          ],
        }),
        page("pk", "projects/karrieredagene", { department_id: "d1" }),
        page("pw", "projects/winter-games", {
          department_id: "dwg",
          translation_refs: [
            translation({ is_published: false }),
            translation({ $id: "t-en", locale: "en" }),
          ],
        }),
        page("pb", "projects/bergensbanelopet", {
          translation_refs: [translation({ is_published: false })],
        }),
        page("pm", "projects/karrieredagene", { visibility: "authenticated" }),
      ],
    });
    expect(await src.servableProjectPaths()).toEqual(
      new Map([
        ["/projects/fadderullan", new Set(["no", "en"])],
        ["/projects/winter-games", new Set(["en"])],
      ])
    );
  });
});

describe("appwriteSource.load: units", () => {
  const overlay: Row = {
    $id: "ct-d1",
    additional_fields: null,
    content_id: "d1",
    content_type: "department",
    description: "<p>Velkomstuka</p>",
    locale: "no",
    short_description: "Velkommen",
    title: "Fadderullan",
  };

  it("maps a unit with its overlay text", async () => {
    const { src } = source({ content_translations: [overlay], pages: [] });
    const item = await src.load({ id: "d1", type: "unit" }, ctx);
    expect(item.entries.map((e) => [e.url, e.title, e.summary])).toEqual([
      ["/units/oslo/fadderullan", "Fadderullan", "Velkommen"],
      ["/units/oslo/fadderullan", "Fadderullan", "Velkommen"],
    ]);
  });

  it("uses the unit's published page only when bound to it", async () => {
    const bound = source({
      content_translations: [],
      pages: [page("pu", "units/oslo/fadderullan", { department_id: "d1" })],
    });
    const item = await bound.src.load({ id: "d1", type: "unit" }, ctx);
    expect(item.entries[0]?.body).toContain("Pakkeliste");

    const stray = source({
      content_translations: [],
      pages: [page("pu", "units/oslo/fadderullan", { department_id: "dwg" })],
    });
    const strayItem = await stray.src.load({ id: "d1", type: "unit" }, ctx);
    expect(strayItem.entries[0]?.body).toBe("");

    const hidden = source({
      content_translations: [],
      pages: [
        page("pu", "units/oslo/fadderullan", {
          department_id: "d1",
          visibility: "authenticated",
        }),
      ],
    });
    const hiddenItem = await hidden.src.load({ id: "d1", type: "unit" }, ctx);
    expect(hiddenItem.entries[0]?.body).toBe("");
  });

  it("drops a national unit whose project page is servable", async () => {
    const { src } = source({
      content_translations: [],
      pages: [
        page("pw", "projects/winter-games", {
          department_id: "dwg",
          translation_refs: [
            translation(),
            translation({ $id: "t-en", locale: "en" }),
          ],
        }),
      ],
    });
    expect((await src.load({ id: "dwg", type: "unit" }, ctx)).entries).toEqual(
      []
    );

    const unserved = source({ content_translations: [], pages: [] });
    expect(
      (await unserved.src.load({ id: "dwg", type: "unit" }, ctx)).entries
    ).toHaveLength(2);
  });

  it("replaces a national unit only in the locale its project page serves", async () => {
    const { src } = source({
      content_translations: [],
      pages: [page("pw", "projects/winter-games", { department_id: "dwg" })],
    });
    const item = await src.load({ id: "dwg", type: "unit" }, ctx);
    expect(item.entries.map((e) => [e.locale, e.url])).toEqual([
      ["en", "/units/national/wintergames"],
    ]);
  });

  it("gives no entries for a unit the site does not route", async () => {
    const { src } = source({
      content_translations: [],
      departments: [
        ...departments,
        department("dnull", "OSL Legacy", "legacy", "1", null),
      ],
      pages: [],
    });
    for (const id of ["ddrift", "dold", "dnull", "gone"]) {
      const item = await src.load({ id, type: "unit" }, ctx);
      expect({ entries: item.entries, id }).toEqual({ entries: [], id });
    }
  });
});

describe("appwriteSource.departmentRelated", () => {
  it("lists the department's events, jobs, news, products and pages", async () => {
    const { src } = source({
      pages: [
        page("ps", "units/oslo/fadderullan/program", { department_id: "d1" }),
        page("pw", "projects/winter-games", { department_id: "dwg" }),
      ],
      events: [
        { $id: "e1", department_id: "d1" },
        { $id: "e2", department_id: "dwg" },
      ],
      jobs: [{ $id: "j1", department_id: "d1" }],
      news: [{ $id: "n1", department_id: "d1" }],
      webshop_products: [
        { $id: "w1", departmentId: "d1" },
        { $id: "w2", department_id: "d1", departmentId: "dwg" },
      ],
    });
    expect(await src.departmentRelated("d1")).toEqual([
      { id: "e1", type: "event" },
      { id: "j1", type: "job" },
      { id: "n1", type: "news" },
      { id: "w1", type: "product" },
      { id: "ps", type: "page" },
    ]);
  });

  it("drops a deactivated unit's sub-page on the department event", async () => {
    const deleted: [SearchType, string][] = [];
    const writer: IndexWriter = {
      applySettings: () => Promise.resolve(),
      deleteIds: () => Promise.resolve(),
      deleteItem: (type, rowId) => {
        deleted.push([type, rowId]);
        return Promise.resolve();
      },
      deleteOlderThan: () => Promise.resolve(),
      upsert: () => Promise.resolve(),
    };
    const { src } = source({
      content_translations: [],
      departments: [
        department("d1", "OSL Fadderullan", "fadderullan", "1", false),
      ],
      events: [],
      jobs: [],
      news: [],
      pages: [
        page("ps", "units/oslo/fadderullan/program", { department_id: "d1" }),
      ],
      webshop_products: [],
    });
    const resolution = resolveTargets({
      action: "update",
      body: null,
      id: "d1",
      kind: "row",
      table: "departments",
    });
    if (resolution.kind !== "targets") {
      throw new Error("expected targets");
    }
    await syncTargets(
      {
        log: () => undefined,
        now: () => ctx.now,
        source: src,
        writer,
      },
      resolution.targets
    );
    expect(deleted).toEqual([
      ["unit", "d1"],
      ["page", "ps"],
    ]);
  });

  it("pages past the first 100 rows", async () => {
    const events = Array.from({ length: 150 }, (_, i) => ({
      $id: `e${i}`,
      department_id: "d1",
    }));
    const { src } = source({
      events,
      jobs: [],
      news: [],
      webshop_products: [],
    });
    expect(await src.departmentRelated("d1")).toHaveLength(150);
  });
});

describe("appwriteSource.listIds", () => {
  it("pages ids with a cursor and the cheap public filter", async () => {
    const events = Array.from({ length: 205 }, (_, i) => ({
      $id: `e${String(i).padStart(3, "0")}`,
      status: i === 3 ? "draft" : "published",
    }));
    const { calls, src } = source({ events });
    const pages: string[][] = [];
    for await (const ids of src.listIds("event")) {
      pages.push(ids);
    }
    expect(pages.map((p) => p.length)).toEqual([100, 100, 4]);
    expect(pages.flat()).not.toContain("e003");
    const first = calls.find((c) => c.tableId === "events");
    expect(first?.queries).toEqual(
      expect.arrayContaining([
        { attribute: "status", method: "equal", values: ["published"] },
        { method: "select", values: ["$id"] },
        { method: "limit", values: [100] },
      ])
    );
  });

  it("lists active departments for units", async () => {
    const { src } = source({});
    const ids: string[] = [];
    for await (const page of src.listIds("unit")) {
      ids.push(...page);
    }
    expect(ids).toEqual(["d1", "dwg", "ddrift"]);
  });
});

describe("departmentNames", () => {
  it("reads each department once and shows its display name", async () => {
    const { calls, db } = fakeDb({ departments });
    const name = departmentNames(db);
    expect(await name("d1")).toBe("Fadderullan");
    expect(await name("d1")).toBe("Fadderullan");
    expect(await name("missing")).toBeNull();
    expect(await name(null)).toBeNull();
    expect(await name(undefined)).toBeNull();
    expect(calls.filter((c) => c.rowId === "d1")).toHaveLength(1);
  });
});

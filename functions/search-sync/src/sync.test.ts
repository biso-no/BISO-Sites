import { describe, expect, it } from "bun:test";
import { codedRowId } from "@repo/shared/search/coded-pages";
import { baseEntry, type MapContext } from "@repo/shared/search/entries/common";
import {
  type SearchEntry,
  type SearchLocale,
  type SearchType,
  searchEntryId,
} from "@repo/shared/search/types";
import type { ItemTarget, SyncTarget } from "./resolve";
import type { LoadedItem, Source } from "./source";
import { type SyncDeps, syncTargets } from "./sync";
import type { IndexWriter } from "./writer";

const NOW = new Date("2026-11-23T12:00:00Z");
const WINTER_GAMES_ROW = codedRowId("/projects/winter-games");
const winterGamesId = (locale: SearchLocale) =>
  searchEntryId("coded", WINTER_GAMES_ROW, locale);

function entry(
  type: SearchType,
  rowId: string,
  locale: "no" | "en",
  url = `/${type}/${rowId}`
): SearchEntry {
  return baseEntry(
    { campusId: "all", locale, rowId, textLocale: locale, type, url },
    { syncedAt: 1 }
  );
}

const entryNo = entry("event", "e1", "no");
const entryEn = entry("event", "e1", "en");
const pageEntry = entry("page", "p2", "no", "/projects/winter-games");

interface FakeWriter extends IndexWriter {
  deleted: [SearchType, string][];
  deletedIds: string[][];
  entryReads: string[];
  upserted: SearchEntry[];
}

function fakeWriter(current: SearchEntry[] = []): FakeWriter {
  const writer: FakeWriter = {
    applySettings: () => Promise.resolve(),
    deleted: [],
    deletedIds: [],
    deleteIds: (ids) => {
      writer.deletedIds.push(ids);
      return Promise.resolve();
    },
    deleteItem: (type, rowId) => {
      writer.deleted.push([type, rowId]);
      return Promise.resolve();
    },
    deleteOlderThan: () => Promise.resolve(),
    entryReads: [],
    getEntry: (id) => {
      writer.entryReads.push(id);
      return Promise.resolve(current.find((e) => e.id === id) ?? null);
    },
    upsert: (entries) => {
      writer.upserted.push(...entries);
      return Promise.resolve();
    },
    upserted: [],
  };
  return writer;
}

interface FakeSource extends Source {
  contexts: MapContext[];
  loadCalls: string[];
  relatedCalls: [string, Date][];
  servableCalls: number;
}

interface Overrides {
  /** Entries already in the index, for `getEntry`. */
  current?: SearchEntry[];
  departmentRelated?: (id: string) => Promise<SyncTarget[]>;
  load?: (target: ItemTarget) => Promise<LoadedItem>;
  servable?: Record<string, SearchLocale[]>;
}

function fakeSource(overrides: Overrides): FakeSource {
  const source: FakeSource = {
    contexts: [],
    departmentRelated: (id, now) => {
      source.relatedCalls.push([id, now]);
      return overrides.departmentRelated?.(id) ?? Promise.resolve([]);
    },
    // Never used by syncTargets.
    async *listIds() {
      yield* [];
    },
    load: (target, ctx) => {
      source.loadCalls.push(`${target.type}:${target.id}`);
      source.contexts.push(ctx);
      return (
        overrides.load?.(target) ??
        Promise.resolve({ entries: [], related: [] })
      );
    },
    loadCalls: [],
    relatedCalls: [],
    servableCalls: 0,
    servableProjectPaths: () => {
      source.servableCalls += 1;
      const served = Object.entries(overrides.servable ?? {});
      return Promise.resolve(
        new Map(served.map(([path, locales]) => [path, new Set(locales)]))
      );
    },
  };
  return source;
}

function setup(overrides: Overrides = {}) {
  const source = fakeSource(overrides);
  const writer = fakeWriter(overrides.current);
  const logs: string[] = [];
  const deps: SyncDeps = {
    log: (message) => logs.push(message),
    now: () => NOW,
    source,
    writer,
  };
  return { deps, logs, source, writer };
}

describe("syncTargets", () => {
  it("upserts the entries of a public item", async () => {
    const { deps, writer } = setup({
      load: () => Promise.resolve({ entries: [entryNo, entryEn], related: [] }),
    });
    const counts = await syncTargets(deps, [{ id: "e1", type: "event" }]);
    expect(writer.upserted).toEqual([entryNo, entryEn]);
    expect(writer.deleted).toEqual([]);
    expect(counts).toEqual({ deleted: 0, upserted: 2 });
  });

  it("deletes the entries of an item that is gone or not public", async () => {
    const { deps, writer } = setup({
      load: () => Promise.resolve({ entries: [], related: [] }),
    });
    const counts = await syncTargets(deps, [{ id: "gone", type: "event" }]);
    expect(writer.deleted).toContainEqual(["event", "gone"]);
    expect(writer.upserted).toEqual([]);
    expect(counts).toEqual({ deleted: 1, upserted: 0 });
  });

  it("syncs related targets once, even when they point back", async () => {
    const { deps, source } = setup({
      load: () =>
        Promise.resolve({
          entries: [],
          related: [
            { id: "p1", type: "page" },
            { id: "u1", type: "unit" },
          ],
        }),
    });
    await syncTargets(deps, [{ id: "u1", type: "unit" }]);
    expect(source.loadCalls).toEqual(["unit:u1", "page:p1"]);
  });

  it("removes a locale's entry that the item no longer has", async () => {
    const { deps, writer } = setup({
      load: () => Promise.resolve({ entries: [entryNo], related: [] }),
    });
    await syncTargets(deps, [{ id: "e1", type: "event" }]);
    expect(writer.upserted).toEqual([entryNo]);
    expect(writer.deletedIds).toEqual([[searchEntryId("event", "e1", "en")]]);
    expect(writer.deleted).toEqual([]);
  });

  it("removes the coded entry a project page has taken over", async () => {
    const { deps, writer } = setup({
      load: () =>
        Promise.resolve({
          codedSkip: {
            path: "/projects/winter-games",
            skipIn: new Set<SearchLocale>(["no", "en"]),
          },
          entries: [pageEntry, { ...pageEntry, id: "x", locale: "en" }],
          related: [],
        }),
    });
    await syncTargets(deps, [{ id: "p2", type: "page" }]);
    expect(writer.upserted.map((e) => e.type)).toEqual(["page", "page"]);
    expect(writer.deletedIds).toEqual([
      [winterGamesId("no"), winterGamesId("en")],
    ]);
  });

  it("swaps the coded entry only in the locale the project page serves", async () => {
    const { deps, writer } = setup({
      load: () =>
        Promise.resolve({
          codedSkip: {
            path: "/projects/winter-games",
            skipIn: new Set<SearchLocale>(["no"]),
          },
          entries: [pageEntry],
          related: [],
        }),
    });
    await syncTargets(deps, [{ id: "p2", type: "page" }]);
    expect(writer.deletedIds).toEqual([
      [searchEntryId("page", "p2", "en")],
      [winterGamesId("no")],
    ]);
    expect(writer.upserted.map((e) => [e.type, e.locale])).toEqual([
      ["page", "no"],
      ["coded", "en"],
    ]);
  });

  it("restores the coded entry when the project page is not servable", async () => {
    const { deps, writer } = setup({
      load: () =>
        Promise.resolve({
          codedSkip: { path: "/projects/winter-games", skipIn: new Set() },
          entries: [],
          related: [],
        }),
    });
    await syncTargets(deps, [{ id: "p2", type: "page" }]);
    expect(writer.deleted).toEqual([["page", "p2"]]);
    expect(writer.deletedIds).toEqual([]);
    expect(writer.upserted.map((e) => [e.type, e.url, e.locale])).toEqual([
      ["coded", "/projects/winter-games", "no"],
      ["coded", "/projects/winter-games", "en"],
    ]);
  });

  it("expands department-related into the department's items", async () => {
    const { deps, source } = setup({
      departmentRelated: () => Promise.resolve([{ id: "j1", type: "job" }]),
      load: (target) =>
        Promise.resolve({
          entries:
            target.type === "unit" ? [entry("unit", "d1", "no", "/u")] : [],
          related: [],
        }),
    });
    await syncTargets(deps, [{ id: "d1", type: "department-related" }]);
    expect(source.relatedCalls).toEqual([["d1", NOW]]);
    expect(source.loadCalls).toContain("job:j1");
  });

  describe("a department event", () => {
    const unitNo = entry("unit", "d1", "no", "/units/oslo/fadderullan");
    const unitEn = entry("unit", "d1", "en", "/units/oslo/fadderullan");
    const named = (e: SearchEntry, title: string) => ({ ...e, title });
    const departmentEvent: SyncTarget[] = [
      { id: "d1", type: "department-related" },
      { id: "d1", type: "unit" },
    ];
    const related = () =>
      Promise.resolve<SyncTarget[]>([{ id: "j1", type: "job" }]);

    it("skips the linked items when the unit's entry is unchanged", async () => {
      const current = [
        named(unitNo, "Fadderullan"),
        named(unitEn, "Fadderullan"),
      ];
      const { deps, logs, source, writer } = setup({
        current,
        departmentRelated: related,
        load: (target) =>
          Promise.resolve({
            entries: target.type === "unit" ? current : [],
            related: [],
          }),
      });
      await syncTargets(deps, departmentEvent);
      expect(source.relatedCalls).toEqual([]);
      // The unit is read once and still written.
      expect(source.loadCalls).toEqual(["unit:d1"]);
      expect(writer.entryReads).toEqual([unitNo.id, unitEn.id]);
      expect(writer.upserted).toEqual(current);
      expect(logs.some((l) => l.includes("unchanged"))).toBe(true);
    });

    it("re-syncs the linked items when the unit is renamed", async () => {
      const { deps, source } = setup({
        current: [named(unitNo, "Fadderullan"), named(unitEn, "Fadderullan")],
        departmentRelated: related,
        load: (target) =>
          Promise.resolve({
            entries:
              target.type === "unit"
                ? [named(unitNo, "Fadderuka"), named(unitEn, "Fadderuka")]
                : [],
            related: [],
          }),
      });
      await syncTargets(deps, departmentEvent);
      expect(source.relatedCalls).toEqual([["d1", NOW]]);
      expect(source.loadCalls).toEqual(["unit:d1", "job:j1"]);
    });

    it("re-syncs the linked items when the unit's URL changes", async () => {
      const { deps, source } = setup({
        current: [unitNo, unitEn],
        departmentRelated: related,
        load: () =>
          Promise.resolve({
            entries: [
              { ...unitNo, url: "/units/bergen/fadderullan" },
              { ...unitEn, url: "/units/bergen/fadderullan" },
            ],
            related: [],
          }),
      });
      await syncTargets(deps, departmentEvent);
      expect(source.relatedCalls).toHaveLength(1);
    });

    it("re-syncs the linked items when the unit appears or disappears", async () => {
      const gone = setup({
        current: [unitNo, unitEn],
        departmentRelated: related,
      });
      await syncTargets(gone.deps, departmentEvent);
      expect(gone.source.relatedCalls).toHaveLength(1);

      const added = setup({
        departmentRelated: related,
        load: () => Promise.resolve({ entries: [unitNo, unitEn], related: [] }),
      });
      await syncTargets(added.deps, departmentEvent);
      expect(added.source.relatedCalls).toHaveLength(1);
    });

    it("compares each locale, so a unit replaced in one locale still counts", async () => {
      // A national unit whose project page serves `no` has only an `en` entry.
      const { deps, source } = setup({
        current: [named(unitEn, "Winter Games")],
        departmentRelated: related,
        load: () =>
          Promise.resolve({
            entries: [named(unitEn, "Winter Games 2027")],
            related: [],
          }),
      });
      await syncTargets(deps, departmentEvent);
      expect(source.relatedCalls).toHaveLength(1);
    });
  });

  it("restores a hub's coded entry when no servable page owns it", async () => {
    const { deps, source, writer } = setup();
    await syncTargets(deps, [
      { id: "winter-games", type: "project-path" },
      { id: "winter-games", type: "project-path" },
    ]);
    expect(source.servableCalls).toBe(1);
    expect(source.loadCalls).toEqual([]);
    expect(writer.deleted).toEqual([]);
    expect(writer.upserted.map((e) => [e.type, e.row_id, e.locale])).toEqual([
      ["coded", WINTER_GAMES_ROW, "no"],
      ["coded", WINTER_GAMES_ROW, "en"],
    ]);
  });

  it("removes a hub's coded entry while a servable page owns it", async () => {
    const { deps, writer } = setup({
      servable: { "/projects/winter-games": ["no", "en"] },
    });
    await syncTargets(deps, [{ id: "winter-games", type: "project-path" }]);
    expect(writer.deletedIds).toEqual([
      [winterGamesId("no"), winterGamesId("en")],
    ]);
    expect(writer.upserted).toEqual([]);
  });

  it("keeps a hub's coded entry in the locale no servable page serves", async () => {
    const { deps, writer } = setup({
      servable: { "/projects/winter-games": ["no"] },
    });
    await syncTargets(deps, [{ id: "winter-games", type: "project-path" }]);
    expect(writer.deletedIds).toEqual([[winterGamesId("no")]]);
    expect(writer.upserted.map((e) => [e.type, e.locale])).toEqual([
      ["coded", "en"],
    ]);
  });

  it("writes nothing for a project with no coded page", async () => {
    const { deps, writer } = setup({
      servable: { "/projects/bergensbanelopet": ["no"] },
    });
    const counts = await syncTargets(deps, [
      { id: "bergensbanelopet", type: "project-path" },
    ]);
    expect(writer.upserted).toEqual([]);
    expect(writer.deleted).toEqual([]);
    expect(writer.deletedIds).toEqual([]);
    expect(counts).toEqual({ deleted: 0, upserted: 0 });
  });

  it("hands every load the same clock and sync time", async () => {
    const { deps, source } = setup();
    const before = Date.now();
    await syncTargets(deps, [
      { id: "e1", type: "event" },
      { id: "n1", type: "news" },
    ]);
    const after = Date.now();
    const [first, second] = source.contexts;
    expect(first?.now).toEqual(NOW);
    expect(first?.syncedAt).toBeGreaterThanOrEqual(before);
    expect(first?.syncedAt).toBeLessThanOrEqual(after);
    expect(second?.syncedAt).toBe(first?.syncedAt as number);
  });

  it("propagates a failed load", async () => {
    const { deps } = setup({
      load: () => Promise.reject(new Error("appwrite down")),
    });
    await expect(
      syncTargets(deps, [{ id: "e1", type: "event" }])
    ).rejects.toThrow("appwrite down");
  });
});

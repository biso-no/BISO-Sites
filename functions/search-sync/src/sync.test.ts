import { describe, expect, it } from "bun:test";
import { codedRowId } from "@repo/shared/search/coded-pages";
import { baseEntry, type MapContext } from "@repo/shared/search/entries/common";
import type { SearchEntry, SearchType } from "@repo/shared/search/types";
import type { ItemTarget, SyncTarget } from "./resolve";
import type { LoadedItem, Source } from "./source";
import { type SyncDeps, syncTargets } from "./sync";
import type { IndexWriter } from "./writer";

const NOW = new Date("2026-11-23T12:00:00Z");
const WINTER_GAMES_ROW = codedRowId("/projects/winter-games");

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
  upserted: SearchEntry[];
}

function fakeWriter(): FakeWriter {
  const writer: FakeWriter = {
    applySettings: () => Promise.resolve(),
    deleted: [],
    deleteItem: (type, rowId) => {
      writer.deleted.push([type, rowId]);
      return Promise.resolve();
    },
    deleteOlderThan: () => Promise.resolve(),
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
  relatedCalls: string[];
  servableCalls: number;
}

interface Overrides {
  departmentRelated?: (id: string) => Promise<SyncTarget[]>;
  load?: (target: ItemTarget) => Promise<LoadedItem>;
  servable?: string[];
}

function fakeSource(overrides: Overrides): FakeSource {
  const source: FakeSource = {
    contexts: [],
    departmentRelated: (id) => {
      source.relatedCalls.push(id);
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
      return Promise.resolve(new Set(overrides.servable ?? []));
    },
  };
  return source;
}

function setup(overrides: Overrides = {}) {
  const source = fakeSource(overrides);
  const writer = fakeWriter();
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

  it("removes the coded entry a project page has taken over", async () => {
    const { deps, writer } = setup({
      load: () =>
        Promise.resolve({
          codedSkip: { path: "/projects/winter-games", skip: true },
          entries: [pageEntry],
          related: [],
        }),
    });
    await syncTargets(deps, [{ id: "p2", type: "page" }]);
    expect(writer.upserted).toEqual([pageEntry]);
    expect(writer.deleted).toContainEqual(["coded", WINTER_GAMES_ROW]);
  });

  it("restores the coded entry when the project page is not servable", async () => {
    const { deps, writer } = setup({
      load: () =>
        Promise.resolve({
          codedSkip: { path: "/projects/winter-games", skip: false },
          entries: [],
          related: [],
        }),
    });
    await syncTargets(deps, [{ id: "p2", type: "page" }]);
    expect(writer.deleted).toEqual([["page", "p2"]]);
    expect(writer.upserted.map((e) => [e.type, e.url, e.locale])).toEqual([
      ["coded", "/projects/winter-games", "no"],
      ["coded", "/projects/winter-games", "en"],
    ]);
  });

  it("expands department-related into the department's items", async () => {
    const { deps, source } = setup({
      departmentRelated: () => Promise.resolve([{ id: "j1", type: "job" }]),
    });
    await syncTargets(deps, [{ id: "d1", type: "department-related" }]);
    expect(source.relatedCalls).toEqual(["d1"]);
    expect(source.loadCalls).toContain("job:j1");
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
    const { deps, writer } = setup({ servable: ["/projects/winter-games"] });
    await syncTargets(deps, [{ id: "winter-games", type: "project-path" }]);
    expect(writer.deleted).toEqual([["coded", WINTER_GAMES_ROW]]);
    expect(writer.upserted).toEqual([]);
  });

  it("writes nothing for a project with no coded page", async () => {
    const { deps, writer } = setup();
    const counts = await syncTargets(deps, [
      { id: "bergensbanelopet", type: "project-path" },
    ]);
    expect(writer.upserted).toEqual([]);
    expect(writer.deleted).toEqual([]);
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

import { describe, expect, it } from "bun:test";
import { baseEntry } from "@repo/shared/search/entries/common";
import type {
  SearchEntry,
  SearchLocale,
  SearchType,
} from "@repo/shared/search/types";
import { runReindex } from "./reindex";
import type { Source } from "./source";
import type { SyncDeps } from "./sync";
import type { IndexWriter } from "./writer";

const NOW = new Date("2026-11-23T12:00:00Z");

interface FakeWriter extends IndexWriter {
  settingsApplied: boolean;
  sweptBefore: number | null;
  upserted: SearchEntry[];
}

function fakeWriter(): FakeWriter {
  const writer: FakeWriter = {
    applySettings: () => {
      writer.settingsApplied = true;
      return Promise.resolve();
    },
    deleteIds: () => Promise.resolve(),
    deleteItem: () => Promise.resolve(),
    deleteOlderThan: (syncedAt) => {
      writer.sweptBefore = syncedAt;
      return Promise.resolve();
    },
    settingsApplied: false,
    sweptBefore: null,
    upsert: (entries) => {
      writer.upserted.push(...entries);
      return Promise.resolve();
    },
    upserted: [],
  };
  return writer;
}

interface Options {
  entriesPer: number;
  ids: Partial<Record<string, string[][]>>;
  servable?: Record<string, SearchLocale[]>;
}

function setup({ entriesPer, ids, servable = {} }: Options) {
  const writer = fakeWriter();
  const source: Source = {
    departmentRelated: () => Promise.resolve([]),
    async *listIds(type) {
      yield* ids[type] ?? [];
    },
    load: (target, ctx) => {
      const entries = Array.from({ length: entriesPer }, (_, i) =>
        baseEntry(
          {
            campusId: "all",
            locale: i % 2 === 0 ? "no" : "en",
            rowId: target.id,
            textLocale: "no",
            type: target.type as SearchType,
            url: `/${target.type}/${target.id}`,
          },
          { syncedAt: ctx.syncedAt }
        )
      );
      return Promise.resolve({ entries, related: [] });
    },
    servableProjectPaths: () =>
      Promise.resolve(
        new Map(
          Object.entries(servable).map(([path, locales]) => [
            path,
            new Set(locales),
          ])
        )
      ),
  };
  const deps: SyncDeps = {
    log: () => undefined,
    now: () => NOW,
    source,
    writer,
  };
  return { deps, writer };
}

describe("runReindex", () => {
  it("applies settings, writes every item and the coded pages, then sweeps", async () => {
    const { deps, writer } = setup({
      entriesPer: 2,
      ids: { event: [["e1", "e2"]], page: [["p1"]] },
    });
    const r = await runReindex(deps);
    expect(writer.settingsApplied).toBe(true);
    expect(r.byType.event).toBe(4);
    expect(r.byType.page).toBe(2);
    expect(writer.upserted.some((e) => e.type === "coded")).toBe(true);
    expect(writer.sweptBefore).toBe(r.sweptBefore);
    // Nothing written this run is swept.
    for (const e of writer.upserted) {
      expect(writer.sweptBefore ?? 0).toBeLessThanOrEqual(e.synced_at);
    }
    expect(r.entries).toBe(writer.upserted.length);
  });

  it("skips a project's coded hub in the locales its page serves", async () => {
    const { deps, writer } = setup({
      entriesPer: 0,
      ids: {},
      servable: {
        "/projects/fadderullan": ["no", "en"],
        "/projects/winter-games": ["no"],
      },
    });
    await runReindex(deps);
    const codedLocales = (url: string) =>
      writer.upserted
        .filter((e) => e.url === url && e.type === "coded")
        .map((e) => e.locale);
    expect(codedLocales("/projects/fadderullan")).toEqual([]);
    expect(codedLocales("/projects/winter-games")).toEqual(["en"]);
    expect(codedLocales("/projects/karrieredagene")).toEqual(["no", "en"]);
  });

  it("upserts in batches of at most 500", async () => {
    const batches: number[] = [];
    const { deps, writer } = setup({
      entriesPer: 2,
      ids: { event: [Array.from({ length: 300 }, (_, i) => `e${i}`)] },
    });
    const original = writer.upsert;
    writer.upsert = (entries) => {
      batches.push(entries.length);
      return original(entries);
    };
    await runReindex(deps);
    expect(batches.every((n) => n <= 500)).toBe(true);
  });
});

import { codedPageEntries } from "@repo/shared/search/coded-pages";
import type { MapContext } from "@repo/shared/search/entries/common";
import type { SearchEntry, SearchType } from "@repo/shared/search/types";
import type { SyncDeps } from "./sync";

// A type alias, not an interface: the handler takes `Record<string, unknown>`,
// which an interface is not assignable to.
// biome-ignore lint/style/useConsistentTypeDefinitions: see above
export type ReindexResult = {
  ok: true;
  /** Entries written this run. */
  entries: number;
  byType: Record<SearchType, number>;
  /** Unix ms stamp of this run; older entries were swept. */
  sweptBefore: number;
};

type ListedType = Exclude<SearchType, "coded">;

const TYPES: readonly ListedType[] = [
  "event",
  "news",
  "job",
  "product",
  "page",
  "unit",
  "document",
];
const LOAD_CONCURRENCY = 5;
const UPSERT_BATCH = 500;

function emptyCounts(): Record<SearchType, number> {
  return {
    coded: 0,
    document: 0,
    event: 0,
    job: 0,
    news: 0,
    page: 0,
    product: 0,
    unit: 0,
  };
}

/** Upsert in batches, so one task never carries an oversized payload. */
async function writeBatches(
  deps: SyncDeps,
  entries: SearchEntry[]
): Promise<void> {
  for (let i = 0; i < entries.length; i += UPSERT_BATCH) {
    await deps.writer.upsert(entries.slice(i, i + UPSERT_BATCH));
  }
}

/** Load a page of ids, `LOAD_CONCURRENCY` at a time. */
async function loadPage(
  deps: SyncDeps,
  type: ListedType,
  ids: string[],
  ctx: MapContext
): Promise<SearchEntry[]> {
  const entries: SearchEntry[] = [];
  for (let i = 0; i < ids.length; i += LOAD_CONCURRENCY) {
    const chunk = ids.slice(i, i + LOAD_CONCURRENCY);
    const loaded = await Promise.all(
      chunk.map((id) => deps.source.load({ id, type }, ctx))
    );
    for (const item of loaded) {
      entries.push(...item.entries);
    }
  }
  return entries;
}

/**
 * Full reindex, stamp and sweep: every entry written here carries
 * `startedAt`, then everything older is deleted. Entries that row events
 * write while this runs are stamped later, so the sweep leaves them alone.
 * Items removed or made non-public while events were off disappear with the
 * sweep.
 */
export async function runReindex(deps: SyncDeps): Promise<ReindexResult> {
  const startedAt = Date.now();
  await deps.writer.applySettings();

  const ctx: MapContext = {
    departmentName: () => null,
    now: deps.now(),
    syncedAt: startedAt,
  };
  const byType = emptyCounts();

  for (const type of TYPES) {
    for await (const ids of deps.source.listIds(type)) {
      const entries = await loadPage(deps, type, ids, ctx);
      await writeBatches(deps, entries);
      byType[type] += entries.length;
    }
    deps.log(`reindex ${type}: ${byType[type]} entries`);
  }

  const coded = codedPageEntries(ctx, await deps.source.servableProjectPaths());
  await writeBatches(deps, coded);
  byType.coded = coded.length;

  await deps.writer.deleteOlderThan(startedAt);

  const entries = Object.values(byType).reduce((sum, n) => sum + n, 0);
  deps.log(`reindex done: ${entries} entries`);
  return { byType, entries, ok: true, sweptBefore: startedAt };
}

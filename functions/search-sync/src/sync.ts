import { codedPageEntries, codedRowId } from "@repo/shared/search/coded-pages";
import type { MapContext } from "@repo/shared/search/entries/common";
import { projectPageSlug } from "@repo/shared/utils/project-units";
import type { ItemTarget, SyncTarget } from "./resolve";
import type { LoadedItem, Source } from "./source";
import type { IndexWriter } from "./writer";

export interface SyncDeps {
  log: (message: string) => void;
  now: () => Date;
  source: Source;
  writer: IndexWriter;
}

interface Counts {
  /** Items whose entries were removed (one delete per item). */
  deleted: number;
  /** Entries written. */
  upserted: number;
}

/** Write one item's entries, or remove them when it has none. */
async function writeItem(
  deps: SyncDeps,
  target: ItemTarget,
  item: LoadedItem,
  counts: Counts
): Promise<void> {
  if (item.entries.length > 0) {
    await deps.writer.upsert(item.entries);
    counts.upserted += item.entries.length;
    deps.log(`${target.type} ${target.id}: ${item.entries.length} entries`);
  } else {
    await deps.writer.deleteItem(target.type, target.id);
    counts.deleted += 1;
    deps.log(`${target.type} ${target.id}: removed`);
  }
}

/** A project page took over (`skip`) or gave back its coded hub's URL. */
async function writeCoded(
  deps: SyncDeps,
  codedSkip: NonNullable<LoadedItem["codedSkip"]>,
  ctx: MapContext,
  counts: Counts
): Promise<void> {
  const { path, skip } = codedSkip;
  if (skip) {
    await deps.writer.deleteItem("coded", codedRowId(path));
    counts.deleted += 1;
    deps.log(`coded ${path}: removed`);
    return;
  }
  const entries = codedPageEntries(ctx).filter((e) => e.url === path);
  if (entries.length === 0) {
    // A project without a coded hub (no hub page in CODED_PAGES).
    return;
  }
  await deps.writer.upsert(entries);
  counts.upserted += entries.length;
  deps.log(`coded ${path}: ${entries.length} entries`);
}

/**
 * Bring the index in step with each target and whatever it touches. Every
 * target is visited once (`type:id`), so related items that point back at
 * each other cannot loop. Each write is idempotent: a repeated or late event
 * converges on the current rows.
 */
export async function syncTargets(
  deps: SyncDeps,
  targets: SyncTarget[]
): Promise<Counts> {
  const counts: Counts = { deleted: 0, upserted: 0 };
  const ctx: MapContext = {
    // Each loader supplies the department name it needs.
    departmentName: () => null,
    now: deps.now(),
    syncedAt: Date.now(),
  };
  const queue = [...targets];
  const visited = new Set<string>();

  for (let target = queue.shift(); target; target = queue.shift()) {
    const key = `${target.type}:${target.id}`;
    if (visited.has(key)) {
      continue;
    }
    visited.add(key);

    if (target.type === "department-related") {
      queue.push(...(await deps.source.departmentRelated(target.id)));
      continue;
    }
    if (target.type === "project-path") {
      // The same servable rule as the reindex: the coded hub shows exactly
      // when no servable page owns the path.
      const path = `/${projectPageSlug(target.id)}`;
      const served = await deps.source.servableProjectPaths();
      await writeCoded(deps, { path, skip: served.has(path) }, ctx, counts);
      continue;
    }
    const item = await deps.source.load(target, ctx);
    await writeItem(deps, target, item, counts);
    if (item.codedSkip) {
      await writeCoded(deps, item.codedSkip, ctx, counts);
    }
    queue.push(...item.related);
  }
  return counts;
}

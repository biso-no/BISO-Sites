import {
  CODED_PAGES,
  codedPageEntries,
  codedRowId,
} from "@repo/shared/search/coded-pages";
import type { MapContext } from "@repo/shared/search/entries/common";
import {
  SEARCH_LOCALES,
  type SearchEntry,
  searchEntryId,
} from "@repo/shared/search/types";
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
  /** Delete writes: an item's entries, or the locales it no longer has. */
  deleted: number;
  /** Entries written. */
  upserted: number;
}

/**
 * Write one item's entries, or remove them when it has none. An item can have
 * an entry in one locale only (news and pages are not indexed in a locale
 * without their own translation), so the locale it lacks is removed too: a
 * translation that was deleted or unpublished must not leave its old entry.
 */
async function writeItem(
  deps: SyncDeps,
  target: ItemTarget,
  item: LoadedItem,
  counts: Counts
): Promise<void> {
  if (item.entries.length > 0) {
    await deps.writer.upsert(item.entries);
    counts.upserted += item.entries.length;
    const missing = SEARCH_LOCALES.filter(
      (locale) => !item.entries.some((e) => e.locale === locale)
    );
    if (missing.length > 0) {
      await deps.writer.deleteIds(
        missing.map((locale) => searchEntryId(target.type, target.id, locale))
      );
      counts.deleted += 1;
    }
    const removed = missing.length > 0 ? `, removed ${missing.join(", ")}` : "";
    deps.log(
      `${target.type} ${target.id}: ${item.entries.length} entries${removed}`
    );
  } else {
    await deps.writer.deleteItem(target.type, target.id);
    counts.deleted += 1;
    deps.log(`${target.type} ${target.id}: removed`);
  }
}

/**
 * A project page took its coded hub's URL over in the locales in `skipIn` and
 * gave it back (or never had it) in the others.
 */
async function writeCoded(
  deps: SyncDeps,
  codedSkip: NonNullable<LoadedItem["codedSkip"]>,
  ctx: MapContext,
  counts: Counts
): Promise<void> {
  const { path, skipIn } = codedSkip;
  if (!CODED_PAGES.some((page) => page.path === path)) {
    // A project without a coded hub (no hub page in CODED_PAGES).
    return;
  }
  if (skipIn.size > 0) {
    const locales = [...skipIn];
    const rowId = codedRowId(path);
    await deps.writer.deleteIds(
      locales.map((locale) => searchEntryId("coded", rowId, locale))
    );
    counts.deleted += 1;
    deps.log(`coded ${path}: removed in ${locales.join(", ")}`);
  }
  const entries = codedPageEntries(ctx, new Map([[path, skipIn]])).filter(
    (e) => e.url === path
  );
  if (entries.length > 0) {
    await deps.writer.upsert(entries);
    counts.upserted += entries.length;
    deps.log(`coded ${path}: ${entries.length} entries`);
  }
}

/** Same existence, title and URL: what linked items and pages show of a unit. */
function sameUnitEntry(
  current: SearchEntry | null,
  fresh: SearchEntry | null
): boolean {
  if (!(current && fresh)) {
    return current === fresh;
  }
  return current.title === fresh.title && current.url === fresh.url;
}

/**
 * Whether a department change left its unit as the index has it: in every
 * locale, the entry in the index (before the unit target writes) and the
 * freshly loaded entry have the same existence, title and URL. Each locale is
 * compared because a national unit can be replaced by its project page in one
 * locale only. The loaded unit is kept in `loaded` for the unit target.
 */
async function unitUnchanged(
  deps: SyncDeps,
  departmentId: string,
  ctx: MapContext,
  loaded: Map<string, LoadedItem>
): Promise<boolean> {
  const target: ItemTarget = { id: departmentId, type: "unit" };
  const [fresh, ...current] = await Promise.all([
    deps.source.load(target, ctx),
    ...SEARCH_LOCALES.map((locale) =>
      deps.writer.getEntry(searchEntryId("unit", departmentId, locale))
    ),
  ]);
  loaded.set(`unit:${departmentId}`, fresh);
  return SEARCH_LOCALES.every((locale, i) =>
    sameUnitEntry(
      current[i] ?? null,
      fresh.entries.find((e) => e.locale === locale) ?? null
    )
  );
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
  /** Items already loaded this run (a department's unit), by `type:id`. */
  const loaded = new Map<string, LoadedItem>();

  for (let target = queue.shift(); target; target = queue.shift()) {
    const key = `${target.type}:${target.id}`;
    if (visited.has(key)) {
      continue;
    }
    visited.add(key);

    if (target.type === "department-related") {
      // Linked items show only the unit's name and depend on its routing, so
      // a change that leaves its entry as it was (such as the daily
      // `project_share` update) re-reads nothing else.
      if (await unitUnchanged(deps, target.id, ctx, loaded)) {
        deps.log(
          `department ${target.id}: unit unchanged, linked items skipped`
        );
        continue;
      }
      // Ahead of the unit target that follows: the unit's entry is the
      // "before" marker the next department event compares against, so it
      // is written last. If a linked item fails, the marker still shows the
      // change and the next event fans out again.
      queue.unshift(
        ...(await deps.source.departmentRelated(target.id, ctx.now))
      );
      continue;
    }
    if (target.type === "project-path") {
      // The same servable rule as the reindex: the coded hub shows exactly
      // when no servable page owns the path.
      const path = `/${projectPageSlug(target.id)}`;
      const served = await deps.source.servableProjectPaths();
      const skipIn = served.get(path) ?? new Set();
      await writeCoded(deps, { path, skipIn }, ctx, counts);
      continue;
    }
    const item = loaded.get(key) ?? (await deps.source.load(target, ctx));
    await writeItem(deps, target, item, counts);
    if (item.codedSkip) {
      await writeCoded(deps, item.codedSkip, ctx, counts);
    }
    queue.push(...item.related);
  }
  return counts;
}

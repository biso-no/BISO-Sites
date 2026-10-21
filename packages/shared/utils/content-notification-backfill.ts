import {
  channelFor,
  contentTableFor,
  lockRowIdFor,
  type NotifyContentType,
} from "./content-notifications";

const CONTENT_TYPES: NotifyContentType[] = ["event", "news", "job"];

export const BACKFILL_LOCK_REASON = "existed before launch";

export interface BackfillRow {
  $id: string;
  campus_id?: string | null;
}

export interface BackfillDeps {
  createLock(
    lockId: string,
    data: Record<string, unknown>
  ): Promise<"created" | "exists">;
  listPublished(
    table: string,
    cursor: string | null
  ): Promise<{ rows: BackfillRow[]; nextCursor: string | null }>;
  /** Used by dry runs to tell existing locks from ones that would be created. */
  lockExists(lockId: string): Promise<boolean>;
}

export interface BackfillCounts {
  created: number;
  existing: number;
}

export interface BackfillResult extends BackfillCounts {
  byTable: Record<"events" | "news" | "jobs", BackfillCounts>;
}

/**
 * Writes a `skipped` lock for every already-published event, news item and
 * job so the notifier never announces content that predates launch. Existing
 * locks are never modified. In a dry run nothing is written; `lockExists`
 * decides whether a row counts as `existing` or as one that would be
 * `created`. Counts are reported per table and as totals.
 */
export async function backfillLocks(
  deps: BackfillDeps,
  opts: { dryRun: boolean }
): Promise<BackfillResult> {
  const byTable: BackfillResult["byTable"] = {
    events: { created: 0, existing: 0 },
    news: { created: 0, existing: 0 },
    jobs: { created: 0, existing: 0 },
  };

  for (const type of CONTENT_TYPES) {
    const table = contentTableFor(type);
    const counts = byTable[table];
    let cursor: string | null = null;
    do {
      const page = await deps.listPublished(table, cursor);
      for (const row of page.rows) {
        const campusId = row.campus_id ?? null;
        const lockId = lockRowIdFor(type, row.$id);
        if (opts.dryRun) {
          counts[(await deps.lockExists(lockId)) ? "existing" : "created"] += 1;
          continue;
        }
        const outcome = await deps.createLock(lockId, {
          content_type: type,
          content_id: row.$id,
          campus_id: campusId,
          channel: channelFor(type, campusId),
          status: "skipped",
          reason: BACKFILL_LOCK_REASON,
        });
        counts[outcome === "created" ? "created" : "existing"] += 1;
      }
      cursor = page.nextCursor;
    } while (cursor);
  }

  const all = Object.values(byTable);
  return {
    byTable,
    created: all.reduce((sum, c) => sum + c.created, 0),
    existing: all.reduce((sum, c) => sum + c.existing, 0),
  };
}

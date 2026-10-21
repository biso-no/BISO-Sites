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
}

export interface BackfillResult {
  created: number;
  existing: number;
}

/**
 * Writes a `skipped` lock for every already-published event, news item and
 * job so the notifier never announces content that predates launch. Existing
 * locks are never modified. In a dry run nothing is written and every row is
 * counted as `created` (whether a lock already exists is unknown without
 * attempting the write).
 */
export async function backfillLocks(
  deps: BackfillDeps,
  opts: { dryRun: boolean }
): Promise<BackfillResult> {
  const result: BackfillResult = { created: 0, existing: 0 };

  for (const type of CONTENT_TYPES) {
    const table = contentTableFor(type);
    let cursor: string | null = null;
    do {
      const page = await deps.listPublished(table, cursor);
      for (const row of page.rows) {
        if (opts.dryRun) {
          result.created += 1;
          continue;
        }
        const campusId = row.campus_id ?? null;
        const outcome = await deps.createLock(lockRowIdFor(type, row.$id), {
          content_type: type,
          content_id: row.$id,
          campus_id: campusId,
          channel: channelFor(type, campusId),
          status: "skipped",
          reason: BACKFILL_LOCK_REASON,
        });
        if (outcome === "created") {
          result.created += 1;
        } else {
          result.existing += 1;
        }
      }
      cursor = page.nextCursor;
    } while (cursor);
  }

  return result;
}

/**
 * Runs the Finago project sync with its progress kept in the
 * `finago_sync_state` row "projects", so the nightly route and the admin's
 * button share one view of what is done: the last full sync, where to resume,
 * and when the last attempt started (which also guards against overlap).
 */

import {
  type SyncDb,
  type SyncDeps,
  type SyncResult,
  syncFinagoProjects,
} from "./finago-project-sync";

export interface RunDb extends SyncDb {
  getRow(
    databaseId: string,
    tableId: string,
    rowId: string
  ): Promise<Record<string, unknown>>;
}

export type RunMode = "manual" | "scheduled";

export type RunSkipReason = "busy" | "cooling_down" | "recent";

export type RunOutcome =
  | { outcome: "ran"; result: SyncResult }
  | { outcome: "skipped"; reason: RunSkipReason };

export interface RunOptions {
  budgetMs?: number;
  mode: RunMode;
  now: Date;
}

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
/** Nightly: nothing runs while the last full sync is younger than this. */
export const FULL_SYNC_EVERY_MS = 20 * HOUR_MS;
/** Nightly: a timed-out or failed run waits this long before continuing. */
export const RETRY_AFTER_MS = 2 * HOUR_MS;
/** Manual: an attempt younger than this may still be running. */
export const BUSY_WINDOW_MS = 5 * MINUTE_MS;
export const STATE_TABLE = "finago_sync_state";
export const STATE_ID = "projects";
const RESULT_MAX = 1000;
const NOT_FOUND = 404;

function isNotFound(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === NOT_FOUND;
}

function ageMs(value: unknown, now: number): number {
  const time = Date.parse(String(value ?? ""));
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : now - time;
}

/** The "projects" state row, or null when it does not exist yet. */
export async function readProjectSyncState(
  db: Pick<RunDb, "getRow">
): Promise<Record<string, unknown> | null> {
  try {
    return await db.getRow("app", STATE_TABLE, STATE_ID);
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

function skipReason(
  state: Record<string, unknown> | null,
  mode: RunMode,
  nowMs: number
): RunSkipReason | null {
  if (mode === "manual") {
    return ageMs(state?.last_attempt_at, nowMs) < BUSY_WINDOW_MS
      ? "busy"
      : null;
  }
  if (ageMs(state?.last_full_at, nowMs) < FULL_SYNC_EVERY_MS) {
    return "recent";
  }
  if (ageMs(state?.last_attempt_at, nowMs) < RETRY_AFTER_MS) {
    return "cooling_down";
  }
  return null;
}

/**
 * Runs one sync step unless the mode's skip rules say not to. Resumes from
 * `next_offset`. Errors are recorded in `last_result` and rethrown.
 */
export async function runProjectSync(
  db: RunDb,
  deps: Omit<SyncDeps, "budgetMs" | "now" | "startOffset">,
  options: RunOptions
): Promise<RunOutcome> {
  const state = await readProjectSyncState(db);
  const reason = skipReason(state, options.mode, options.now.getTime());
  if (reason) {
    return { outcome: "skipped", reason };
  }

  const nowIso = options.now.toISOString();
  const startOffset = Number(state?.next_offset ?? 0) || 0;
  // First, so it is both the cooldown and the lock against overlap.
  if (state) {
    await db.updateRow("app", STATE_TABLE, STATE_ID, {
      last_attempt_at: nowIso,
    });
  } else {
    await db.createRow("app", STATE_TABLE, STATE_ID, {
      last_attempt_at: nowIso,
    });
  }

  try {
    const result = await syncFinagoProjects(db, {
      ...deps,
      budgetMs: options.budgetMs,
      now: options.now,
      startOffset,
    });
    await db.updateRow("app", STATE_TABLE, STATE_ID, {
      last_result: JSON.stringify(result).slice(0, RESULT_MAX),
      ...(result.partial
        ? {
            next_offset:
              result.accountCount > 0
                ? (startOffset + result.completed) % result.accountCount
                : 0,
          }
        : { last_full_at: nowIso, next_offset: 0 }),
    });
    return { outcome: "ran", result };
  } catch (error) {
    await db
      .updateRow("app", STATE_TABLE, STATE_ID, {
        last_result:
          `error: ${error instanceof Error ? error.message : String(error)}`.slice(
            0,
            RESULT_MAX
          ),
      })
      .catch(() => undefined);
    throw error;
  }
}

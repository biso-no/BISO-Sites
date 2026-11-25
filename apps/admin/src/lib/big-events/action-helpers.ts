import "server-only";

import type { createAdminClient } from "@repo/api/server";
import { BIG_EVENT_TABLES } from "@repo/shared/big-events/tables";
import type { BigEventParticipantRow } from "@repo/shared/big-events/types";
import { mapAllSettledWithConcurrency } from "@repo/shared/utils/concurrency";
import { revalidatePath } from "next/cache";
import { getBigEvent } from "@/app/(portal)/_actions/big-events";
import type { BigEventAccess } from "@/lib/big-events/access";

/** Helpers the big-event server actions share. Plain module: no "use server". */

export type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];
export type GrantedAccess = Exclude<BigEventAccess, null>;

const DATABASE_ID = "app";
const PARTICIPANTS = BIG_EVENT_TABLES.participants;

export const WRITE_CONCURRENCY = 8;

/** The big event, after checking the caller may see it. */
export async function requireBigEvent(bigEventId: string) {
  const found = await getBigEvent(bigEventId);
  if (!found) {
    throw new Error("This big event doesn't exist or you can't see it");
  }
  return found;
}

export function revalidateBigEvent(bigEventId: string): void {
  revalidatePath("/big-events");
  revalidatePath(`/big-events/${bigEventId}`, "layout");
}

/** What one write phase did. Counts only: they go into the audit log. */
export interface PhaseCount {
  failed: number;
  written: number;
}

/**
 * Runs every write of a phase to the end, even when some fail (ruling R28),
 * so nothing is still writing when the next phase or the caller looks.
 * `label` names the writes in the error log.
 */
export async function settleWrites<T, R>(
  items: T[],
  write: (item: T) => Promise<R>,
  label = "import"
): Promise<{ count: PhaseCount; done: R[] }> {
  const results = await mapAllSettledWithConcurrency(
    items,
    WRITE_CONCURRENCY,
    write
  );
  const done: R[] = [];
  const errors: unknown[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      done.push(result.value);
    } else {
      errors.push(result.reason);
    }
  }
  if (errors.length > 0) {
    console.error(
      `[big-events] ${errors.length} ${label} writes failed; the first:`,
      errors[0]
    );
  }
  return { count: { failed: errors.length, written: done.length }, done };
}

/** What the writes did; `complete` only when every phase wrote everything. */
export interface WriteLog {
  complete: boolean;
  phases: Record<string, PhaseCount>;
}

export function newWriteLog(): WriteLog {
  return { complete: false, phases: {} };
}

/**
 * Runs every write of one phase to the end, even when some fail, and logs
 * the counts. Returns the items written, or null when any write failed so
 * the caller stops before the next phase.
 */
export async function writePhase<T>(
  log: WriteLog,
  name: string,
  items: T[],
  write: (item: T) => Promise<unknown>
): Promise<T[] | null> {
  if (items.length === 0) {
    return [];
  }
  const results = await mapAllSettledWithConcurrency(
    items,
    WRITE_CONCURRENCY,
    write
  );
  const done = items.filter(
    (_, index) => results[index]?.status === "fulfilled"
  );
  const failed = items.length - done.length;
  log.phases[name] = { failed, written: done.length };
  if (failed === 0) {
    return done;
  }
  const first = results.find((result) => result.status === "rejected");
  console.error(
    `[big-events] ${failed} bus board writes failed; the first:`,
    first?.status === "rejected" ? first.reason : undefined
  );
  return null;
}

export function assertComplete(log: WriteLog): void {
  if (!log.complete) {
    throw new Error("Some changes couldn't be saved. Try again.");
  }
}

/** Owed bus notices (N1): one timestamp per person, overwritten, never added up. */
export function markNotices(
  db: AdminDb,
  log: WriteLog,
  participantIds: string[],
  now: string
): Promise<string[] | null> {
  return writePhase(log, "notices", participantIds, (id) =>
    db.updateRow<BigEventParticipantRow>(DATABASE_ID, PARTICIPANTS, id, {
      bus_notice_due_at: now,
    })
  );
}

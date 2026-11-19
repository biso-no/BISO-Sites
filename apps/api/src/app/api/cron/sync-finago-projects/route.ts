import { createAdminClient } from "@repo/api/server";
import type { FinagoSyncState } from "@repo/api/types/appwrite";
import { getProjects, listCostLines } from "@repo/connectors/24sevenoffice";
import { syncFinagoProjects } from "@repo/shared/utils/finago-project-sync";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { NextResponse } from "next/server";

/**
 * Finago project sync: projects, their booking history and each department's
 * project share. The dispatcher ticks every 5 minutes, so progress lives in
 * the `finago_sync_state` row "projects": nothing runs while the last full sync
 * is under 20 hours old, nor within 2 hours of the last attempt (a timed-out
 * or failed run waits, then continues from `next_offset`). The attempt time is
 * written before the sync starts, so it also guards against overlap.
 * `?force=1` bypasses both checks. Sends `x-cron-secret` from the dispatcher,
 * or `Authorization: Bearer ${CRON_SECRET}` when run by hand.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const HOUR_MS = 3_600_000;
const FULL_SYNC_EVERY_MS = 20 * HOUR_MS;
const RETRY_AFTER_MS = 2 * HOUR_MS;
const STATE_TABLE = "finago_sync_state";
const STATE_ID = "projects";
const RESULT_MAX = 1000;
const NOT_FOUND = 404;

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

function isNotFound(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === NOT_FOUND;
}

function ageMs(value: unknown, now: number): number {
  const time = Date.parse(String(value ?? ""));
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : now - time;
}

async function readState(db: AdminDb): Promise<FinagoSyncState | null> {
  try {
    return await db.getRow<FinagoSyncState>("app", STATE_TABLE, STATE_ID);
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

async function writeState(
  db: AdminDb,
  exists: boolean,
  data: Record<string, unknown>
): Promise<void> {
  if (exists) {
    await db.updateRow("app", STATE_TABLE, STATE_ID, data);
    return;
  }
  await db.createRow("app", STATE_TABLE, STATE_ID, data);
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

function hasValidCronSecret(request: Request, secret: string): boolean {
  return [readBearerToken(request), request.headers.get("x-cron-secret")].some(
    (candidate) => safeSecretCompare(candidate, secret)
  );
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[Finago Project Sync] CRON_SECRET is not configured");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  if (!hasValidCronSecret(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { db } = await createAdminClient();
    const state = await readState(db);
    const nowMs = Date.now();
    if (new URL(request.url).searchParams.get("force") !== "1") {
      if (ageMs(state?.last_full_at, nowMs) < FULL_SYNC_EVERY_MS) {
        return NextResponse.json({ reason: "recent", skipped: true });
      }
      if (ageMs(state?.last_attempt_at, nowMs) < RETRY_AFTER_MS) {
        return NextResponse.json({ reason: "cooling_down", skipped: true });
      }
    }

    const now = new Date(nowMs);
    const startOffset = state?.next_offset ?? 0;
    // First, so it is both the cooldown and the lock against overlap.
    await writeState(db, state !== null, {
      last_attempt_at: now.toISOString(),
    });
    try {
      const counts = await syncFinagoProjects(db, {
        getProjects,
        listCostLines,
        now,
        startOffset,
      });
      await db.updateRow("app", STATE_TABLE, STATE_ID, {
        last_result: JSON.stringify(counts).slice(0, RESULT_MAX),
        ...(counts.partial
          ? {
              next_offset:
                counts.accountCount > 0
                  ? (startOffset + counts.completed) % counts.accountCount
                  : 0,
            }
          : { last_full_at: now.toISOString(), next_offset: 0 }),
      });
      console.log("[Finago Project Sync] Done", counts);
      return NextResponse.json(counts);
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
  } catch (error) {
    console.error("[Finago Project Sync] Sync failed:", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

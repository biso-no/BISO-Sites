import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { BIG_EVENT_TABLES } from "@repo/shared/big-events/tables";
import { NextResponse } from "next/server";
import { hasValidCronSecret } from "@/lib/cron-auth";

/**
 * Big event retention. Driven by the `scheduled-dispatch` Appwrite Function
 * (`BIG_EVENTS_CLEANUP_URL`), which sends `x-cron-secret`; can also be hit
 * manually with `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Deletes participants, group memberships and email deliveries 30 days after a
 * big event ends. The event and its groups stay. Bounded per run (1000 rows);
 * the next run picks up whatever is left.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_DAYS = 30;
const EVENTS_PER_PAGE = 25;
const BATCH_SIZE = 100;
const CHUNK_SIZE = 5;
/** Total rows deleted per run across all events and tables. */
const MAX_DELETES_PER_RUN = 1000;

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

interface Budget {
  left: number;
}

async function deleteForEvent(
  db: AdminDb,
  table: string,
  bigEventId: string,
  budget: Budget
): Promise<number> {
  let deleted = 0;
  while (budget.left > 0) {
    const limit = Math.min(BATCH_SIZE, budget.left);
    const { rows } = await db.listRows("app", table, [
      Query.equal("big_event_id", bigEventId),
      Query.limit(limit),
      Query.select(["$id"]),
    ]);
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      await Promise.all(
        rows
          .slice(i, i + CHUNK_SIZE)
          .map((row) => db.deleteRow("app", table, row.$id))
      );
    }
    deleted += rows.length;
    budget.left -= rows.length;
    if (rows.length < limit) {
      break;
    }
  }
  return deleted;
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[Big Event Cleanup] CRON_SECRET is not configured");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  if (!hasValidCronSecret(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * DAY_MS);
    const { db } = await createAdminClient();
    const budget: Budget = { left: MAX_DELETES_PER_RUN };
    let participantsDeleted = 0;
    let membersDeleted = 0;
    let deliveriesDeleted = 0;
    let cursor: string | undefined;
    while (budget.left > 0) {
      const { rows: events } = await db.listRows(
        "app",
        BIG_EVENT_TABLES.events,
        [
          Query.lessThanEqual("ends_at", cutoff.toISOString()),
          Query.orderAsc("$id"),
          Query.limit(EVENTS_PER_PAGE),
          Query.select(["$id"]),
          ...(cursor ? [Query.cursorAfter(cursor)] : []),
        ]
      );
      for (const event of events) {
        participantsDeleted += await deleteForEvent(
          db,
          BIG_EVENT_TABLES.participants,
          event.$id,
          budget
        );
        membersDeleted += await deleteForEvent(
          db,
          BIG_EVENT_TABLES.groupMembers,
          event.$id,
          budget
        );
        deliveriesDeleted += await deleteForEvent(
          db,
          BIG_EVENT_TABLES.deliveries,
          event.$id,
          budget
        );
      }
      if (events.length < EVENTS_PER_PAGE) {
        break;
      }
      cursor = events.at(-1)?.$id;
    }

    console.log(
      `[Big Event Cleanup] Deleted ${participantsDeleted} participants, ${membersDeleted} group members and ${deliveriesDeleted} deliveries`
    );
    return NextResponse.json({
      deliveriesDeleted,
      membersDeleted,
      participantsDeleted,
    });
  } catch (error) {
    console.error("[Big Event Cleanup] Cleanup failed:", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

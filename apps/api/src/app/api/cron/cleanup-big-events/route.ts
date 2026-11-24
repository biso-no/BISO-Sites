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
 * big event ends. The event and its groups stay. Bounded per run; the next run
 * picks up whatever is left.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_DAYS = 30;
const EVENTS_PER_RUN = 25;
const BATCH_SIZE = 100;
const MAX_BATCHES = 10;

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

async function deleteForEvent(
  db: AdminDb,
  table: string,
  bigEventId: string
): Promise<number> {
  let deleted = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const { rows } = await db.listRows("app", table, [
      Query.equal("big_event_id", bigEventId),
      Query.limit(BATCH_SIZE),
      Query.select(["$id"]),
    ]);
    for (const row of rows) {
      await db.deleteRow("app", table, row.$id);
      deleted += 1;
    }
    if (rows.length < BATCH_SIZE) {
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
    const { rows: events } = await db.listRows("app", BIG_EVENT_TABLES.events, [
      Query.lessThanEqual("ends_at", cutoff.toISOString()),
      Query.limit(EVENTS_PER_RUN),
      Query.select(["$id"]),
    ]);

    let participantsDeleted = 0;
    let membersDeleted = 0;
    let deliveriesDeleted = 0;
    for (const event of events) {
      participantsDeleted += await deleteForEvent(
        db,
        BIG_EVENT_TABLES.participants,
        event.$id
      );
      membersDeleted += await deleteForEvent(
        db,
        BIG_EVENT_TABLES.groupMembers,
        event.$id
      );
      deliveriesDeleted += await deleteForEvent(
        db,
        BIG_EVENT_TABLES.deliveries,
        event.$id
      );
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

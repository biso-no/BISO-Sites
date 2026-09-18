import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { NextResponse } from "next/server";

/**
 * Member pass retention. Driven by the `scheduled-dispatch` Appwrite Function
 * (`MEMBER_PASS_CLEANUP_URL`), which sends `x-cron-secret`; can also be hit
 * manually with `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Deletes scan-log rows after 90 days and scanner links 30 days after they
 * expired. Bounded per run; the next run picks up whatever is left.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const DAY_MS = 24 * 60 * 60 * 1000;
const SCAN_RETENTION_DAYS = 90;
const LINK_RETENTION_DAYS = 30;
const BATCH_SIZE = 100;
const MAX_BATCHES = 10;

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

function hasValidCronSecret(request: Request, secret: string): boolean {
  return [readBearerToken(request), request.headers.get("x-cron-secret")].some(
    (candidate) => safeSecretCompare(candidate, secret)
  );
}

async function deleteOlderThan(
  db: AdminDb,
  table: string,
  column: string,
  cutoff: Date
): Promise<number> {
  let deleted = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const { rows } = await db.listRows("app", table, [
      Query.lessThan(column, cutoff.toISOString()),
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
    console.error("[Member Pass Cleanup] CRON_SECRET is not configured");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  if (!hasValidCronSecret(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const now = Date.now();
    const { db } = await createAdminClient();
    const scansDeleted = await deleteOlderThan(
      db,
      "member_pass_scans",
      "$createdAt",
      new Date(now - SCAN_RETENTION_DAYS * DAY_MS)
    );
    const linksDeleted = await deleteOlderThan(
      db,
      "member_pass_scanner_links",
      "expires_at",
      new Date(now - LINK_RETENTION_DAYS * DAY_MS)
    );

    console.log(
      `[Member Pass Cleanup] Deleted ${scansDeleted} scans and ${linksDeleted} links`
    );
    return NextResponse.json({ linksDeleted, scansDeleted });
  } catch (error) {
    console.error("[Member Pass Cleanup] Cleanup failed:", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

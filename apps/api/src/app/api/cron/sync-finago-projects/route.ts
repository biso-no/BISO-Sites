import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { getProjects, listCostLines } from "@repo/connectors/24sevenoffice";
import { syncFinagoProjects } from "@repo/shared/utils/finago-project-sync";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { NextResponse } from "next/server";

/**
 * Nightly Finago project sync: projects, their booking history and each
 * department's project share. The dispatcher ticks every 5 minutes, so the
 * route does nothing unless the last FULL sync is over 20 hours old (a full
 * run stamps `finago_projects.synced_at`; a partial one doesn't, so the next
 * tick continues). `?force=1` runs anyway. Sends `x-cron-secret` from the scheduled
 * dispatcher, or `Authorization: Bearer ${CRON_SECRET}` when run by hand.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const DUE_AFTER_MS = 20 * 60 * 60 * 1000;

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
    const force = new URL(request.url).searchParams.get("force") === "1";
    if (!force) {
      const { rows } = await db.listRows("app", "finago_projects", [
        Query.isNotNull("synced_at"),
        Query.orderDesc("synced_at"),
        Query.limit(1),
        Query.select(["synced_at"]),
      ]);
      const last = Date.parse(String(rows[0]?.synced_at ?? ""));
      if (!Number.isNaN(last) && Date.now() - last < DUE_AFTER_MS) {
        return NextResponse.json({ reason: "recent", skipped: true });
      }
    }
    const counts = await syncFinagoProjects(db, {
      getProjects,
      listCostLines,
      now: new Date(),
    });
    console.log("[Finago Project Sync] Done", counts);
    return NextResponse.json(counts);
  } catch (error) {
    console.error("[Finago Project Sync] Sync failed:", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

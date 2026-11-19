import { createAdminClient } from "@repo/api/server";
import { getProjects, listCostLines } from "@repo/connectors/24sevenoffice";
import { runProjectSync } from "@repo/shared/utils/finago-project-run";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { NextResponse } from "next/server";

/**
 * Finago project sync: projects, their booking history and each department's
 * project share. The dispatcher ticks every 5 minutes, so progress lives in
 * the `finago_sync_state` row "projects": nothing runs while the last full sync
 * is under 20 hours old, nor within 2 hours of the last attempt (a timed-out
 * or failed run waits, then continues from `next_offset`). The attempt time is
 * written before the sync starts, so it also guards against overlap.
 * `?force=1` runs like the admin's button: it bypasses both checks but
 * still refuses within 5 minutes of the last attempt. Sends `x-cron-secret`
 * from the dispatcher, or `Authorization: Bearer ${CRON_SECRET}` by hand.
 * Reading Finago stops after `FINAGO_PROJECTS_SYNC_BUDGET_MS` (default 20 s,
 * so saving still fits the api site's 30-second limit); a run cut short
 * continues on a later tick.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const DEFAULT_BUDGET_MS = 20_000;

function readBudgetMs(): number {
  const value = Number(process.env.FINAGO_PROJECTS_SYNC_BUDGET_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_BUDGET_MS;
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
    const force = new URL(request.url).searchParams.get("force") === "1";
    const run = await runProjectSync(
      db,
      { getProjects, listCostLines },
      {
        budgetMs: readBudgetMs(),
        mode: force ? "manual" : "scheduled",
        now: new Date(),
      }
    );
    if (run.outcome === "skipped") {
      return NextResponse.json({ reason: run.reason, skipped: true });
    }
    console.log("[Finago Project Sync] Done", run.result);
    return NextResponse.json(run.result);
  } catch (error) {
    console.error("[Finago Project Sync] Sync failed:", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

import { type Models, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { type NextRequest, NextResponse } from "next/server";
import { postRetentionWebhook, RETENTION_RUN_DAYS } from "@/lib/it/turnover";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TURNOVER_JOBS_TABLE = "m365_turnover_jobs";
const SWEEP_PAGE_SIZE = 50;

type TurnoverJobRow = Models.Row & {
  user_id: string;
  user_upn: string;
  stop_attempts?: number | null;
};

function readBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

function hasValidSecret(request: NextRequest, secret: string) {
  // Header-only — keep the secret out of access logs / referrers.
  const candidates = [
    readBearerToken(request),
    request.headers.get("x-cron-secret"),
  ];
  return candidates.some((candidate) => safeSecretCompare(candidate, secret));
}

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

async function stopJob(
  db: AdminDb,
  job: TurnoverJobRow,
  stopUrl: string
): Promise<"stopped" | "failed"> {
  const result = await postRetentionWebhook(stopUrl, {
    action: "stop",
    userId: job.user_id,
    userUpn: job.user_upn,
    retentionDays: RETENTION_RUN_DAYS,
    turnoverJobId: job.$id,
  });

  if (result.ok) {
    await db.updateRow("app", TURNOVER_JOBS_TABLE, job.$id, {
      status: "completed",
      last_error: null,
      stop_attempts: (job.stop_attempts ?? 0) + 1,
    });
    return "stopped";
  }

  // Leave the job as stop_failed so the next sweep retries it — the retention
  // run staying open a bit longer is safe; silently dropping it is not.
  await db.updateRow("app", TURNOVER_JOBS_TABLE, job.$id, {
    status: "stop_failed",
    last_error: result.error ?? "Retention stop webhook failed",
    stop_attempts: (job.stop_attempts ?? 0) + 1,
  });
  return "failed";
}

/**
 * Stops Azure Automation retention runs whose 7-day hold has elapsed. Driven on
 * a schedule by the `scheduled-dispatch` Appwrite Function
 * (`TURNOVER_RETENTION_STOP_URL`); gated by CRON_SECRET, no user session.
 *
 * Picks up both `retention_active` jobs that have reached their stop time and
 * `stop_failed` jobs from a previous sweep (retry).
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { code: "SECRET_NOT_CONFIGURED", error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }
  if (!hasValidSecret(request, secret)) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", error: "Unauthorized" },
      { status: 401 }
    );
  }

  const stopUrl = process.env.AZURE_RETENTION_STOP_WEBHOOK_URL;
  if (!stopUrl) {
    return NextResponse.json(
      {
        code: "STOP_URL_NOT_CONFIGURED",
        error: "AZURE_RETENTION_STOP_WEBHOOK_URL is not configured",
      },
      { status: 500 }
    );
  }

  try {
    const { db } = await createAdminClient();
    const nowIso = new Date().toISOString();

    const due = await db.listRows<TurnoverJobRow>("app", TURNOVER_JOBS_TABLE, [
      Query.equal("status", ["retention_active", "stop_failed"]),
      Query.lessThanEqual("retention_stop_at", nowIso),
      Query.limit(SWEEP_PAGE_SIZE),
    ]);

    let stopped = 0;
    let failed = 0;
    for (const job of due.rows) {
      const outcome = await stopJob(db, job, stopUrl);
      if (outcome === "stopped") {
        stopped += 1;
      } else {
        failed += 1;
      }
    }

    return NextResponse.json(
      {
        ok: true,
        stopped,
        failed,
        scanned: due.rows.length,
        timestamp: nowIso,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[it/turnover/stop-retention] Unexpected error:", error);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export function GET(request: NextRequest) {
  return handle(request);
}

export function POST(request: NextRequest) {
  return handle(request);
}

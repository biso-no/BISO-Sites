import type { Reporter } from "@repo/observability/functions";
import type { SyncResult } from "./run";

const SLUG = "member-roster-sync";
const MS_PER_SECOND = 1000;
const DEFAULT_SCHEDULE = "0 3 * * *";

/** Cron monitor settings, upserted on every check-in. */
function monitorConfig(env: Record<string, string | undefined>) {
  return {
    checkinMargin: 30,
    failureIssueThreshold: 2,
    maxRuntime: 20,
    recoveryThreshold: 1,
    schedule: env.MEMBER_ROSTER_SYNC_SCHEDULE || DEFAULT_SCHEDULE,
    timezone: "UTC",
  };
}

/**
 * Run the sync inside a Sentry cron check-in. An overlap skip closes `ok` so
 * it never alerts; a throw or `ok: false` closes `error` and sends an event
 * whose message carries no member data.
 */
export async function runMonitored(
  reporter: Reporter,
  run: () => Promise<SyncResult>,
  env: Record<string, string | undefined> = process.env
): Promise<SyncResult> {
  const startedAt = Date.now();
  const checkInId = reporter.checkIn(SLUG, "in_progress", {
    monitorConfig: monitorConfig(env),
  });
  const close = (status: "ok" | "error") =>
    reporter.checkIn(SLUG, status, {
      checkInId,
      durationSeconds: (Date.now() - startedAt) / MS_PER_SECOND,
    });

  let result: SyncResult;
  try {
    result = await run();
  } catch (error) {
    reporter.captureError(error);
    close("error");
    throw error;
  }

  if (result.ok) {
    close("ok");
  } else {
    reporter.captureError(new Error("member-roster-sync failed"));
    close("error");
  }
  return result;
}

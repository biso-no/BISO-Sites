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

const STACK_FRAME = /^\s+at /;

/**
 * A copy of the error that keeps its name and stack frames but never its
 * message: 24SO messages can name companies or customers.
 */
function sanitized(error: unknown): Error {
  const name = error instanceof Error ? error.name : "unknown";
  const copy = new Error(`${SLUG} failed: ${name}`);
  if (error instanceof Error && error.stack) {
    const frames = error.stack
      .split("\n")
      .filter((line) => STACK_FRAME.test(line));
    copy.stack = [`Error: ${copy.message}`, ...frames].join("\n");
  }
  return copy;
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
    reporter.captureError(sanitized(error));
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

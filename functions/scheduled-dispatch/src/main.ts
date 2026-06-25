/**
 * Scheduled-dispatch Appwrite Function.
 *
 * Runs on the cron `schedule` configured in the Appwrite console and pings the
 * apps' secret-gated cron endpoints in parallel. The real work lives in the
 * Next.js apps (single source of truth); this function is just the scheduler the
 * Appwrite platform provides.
 *
 * This function also has a public domain (scheduler.biso.no). Appwrite treats
 * domain/HTTP executions as unauthenticated guests, so HTTP-triggered runs must
 * present the shared secret (via `x-cron-secret` or `Authorization: Bearer`)
 * before any endpoint is pinged. Scheduled (and event) executions are platform-
 * internal and trusted, so they run without it.
 *
 * Logging: Appwrite does NOT log the request/response by default, so every code
 * path here logs through the context `log()` / `error()` helpers — the only way
 * to see what happened in the Console (Logs / Errors tabs). The whole handler is
 * wrapped in a try/catch so an unexpected throw still surfaces a stack trace in
 * the Errors tab and returns a clean response instead of an opaque crash.
 *
 * The overall execution time limit is the function's `timeout` setting, managed
 * in the Appwrite console — NOT controlled here. Keep it comfortably above
 * CRON_TIMEOUT_MS.
 *
 * Required env vars (set on the function in the Appwrite console):
 *   CRON_SECRET                 shared secret sent to (and checked by) the endpoints
 * Optional:
 *   ANNOUNCEMENTS_DISPATCH_URL  e.g. https://admin.biso.no/api/announcements/dispatch
 *   TICKSTER_SYNC_URL           e.g. https://api.biso.no/api/tickster/sync
 *   TICKSTER_EVENTS_SYNC_URL    e.g. https://api.biso.no/api/tickster/events/sync
 *   DEPARTURES_SYNC_URL         e.g. https://api.biso.no/api/departures/sync
 *   RESERVATIONS_CLEANUP_URL    e.g. https://biso.no/api/cron/cleanup-reservations
 *   CRON_TIMEOUT_MS             per-request timeout (default 30000)
 *
 * Note: every target authenticates against CRON_SECRET (admin, web, and both
 * apps/api syncs), so set the same CRON_SECRET on each app. The api syncs still
 * honor their legacy TICKSTER_SYNC_SECRET / ENTUR_SYNC_SECRET as a fallback.
 */

import { timingSafeEqual } from "node:crypto";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_BODY_CHARS = 500;
const BEARER_PREFIX = "Bearer ";
const LOG_TAG = "[scheduled-dispatch]";

/** Env vars that hold a target endpoint URL, in dispatch order. */
const TARGET_ENV_VARS = [
  "ANNOUNCEMENTS_DISPATCH_URL",
  "TICKSTER_SYNC_URL",
  "TICKSTER_EVENTS_SYNC_URL",
  "DEPARTURES_SYNC_URL",
  "RESERVATIONS_CLEANUP_URL",
] as const;

type LogFn = (...messages: unknown[]) => void;

/** Minimal shape of the Appwrite Functions runtime context we use. */
interface AppwriteContext {
  error: LogFn;
  log: LogFn;
  req: {
    headers?: Record<string, string>;
    method?: string;
  };
  res: {
    json: (
      data: unknown,
      statusCode?: number,
      headers?: Record<string, string>
    ) => unknown;
  };
}

interface Target {
  name: string;
  url: string;
}

interface PingResult {
  body?: string;
  durationMs: number;
  error?: string;
  name: string;
  ok: boolean;
  status?: number;
  url: string;
}

/**
 * Constant-time secret comparison. This function is deployed standalone (outside
 * the monorepo workspace), so it can't import `@repo/shared`; the logic mirrors
 * `safeSecretCompare` there. A plain `===` short-circuits on the first differing
 * byte and leaks timing; only the secret length is observable here.
 */
function safeSecretCompare(
  candidate: string | null | undefined,
  secret: string
): boolean {
  if (!candidate) {
    return false;
  }
  const a = Buffer.from(candidate);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

function readBearer(headers: Record<string, string>): string | null {
  const auth = headers.authorization;
  if (auth?.startsWith(BEARER_PREFIX)) {
    return auth.slice(BEARER_PREFIX.length);
  }
  return null;
}

function resolveTimeoutMs(): number {
  return (
    Number.parseInt(process.env.CRON_TIMEOUT_MS ?? "", 10) || DEFAULT_TIMEOUT_MS
  );
}

/** Read the configured endpoint URLs from the environment. */
function collectTargets(): { skipped: string[]; targets: Target[] } {
  const targets: Target[] = [];
  const skipped: string[] = [];
  for (const name of TARGET_ENV_VARS) {
    const url = process.env[name];
    if (typeof url === "string" && url.length > 0) {
      targets.push({ name, url });
    } else {
      skipped.push(name);
    }
  }
  return { skipped, targets };
}

/** HTTP/domain triggers must present the shared secret; logs the outcome. */
function authorizeHttpTrigger(
  headers: Record<string, string>,
  secret: string,
  log: LogFn,
  error: LogFn
): boolean {
  const presented = headers["x-cron-secret"] ?? readBearer(headers);
  if (safeSecretCompare(presented, secret)) {
    log(`${LOG_TAG} HTTP trigger authorized`);
    return true;
  }
  error(
    `${LOG_TAG} unauthorized HTTP trigger — ${presented ? "invalid" : "missing"} secret`
  );
  return false;
}

async function ping(
  target: Target,
  secret: string,
  timeoutMs: number
): Promise<PingResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: { "x-cron-secret": secret },
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      name: target.name,
      url: target.url,
      status: response.status,
      ok: response.ok,
      body: text.slice(0, MAX_BODY_CHARS),
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      name: target.name,
      url: target.url,
      ok: false,
      error: describePingError(err, timeoutMs),
      durationMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

function describePingError(err: unknown, timeoutMs: number): string {
  if (err instanceof Error && err.name === "AbortError") {
    return `request aborted after ${timeoutMs}ms (CRON_TIMEOUT_MS)`;
  }
  return err instanceof Error ? err.message : String(err);
}

/** Emit one log/error line per ping so the Console shows every endpoint. */
function logResults(results: PingResult[], log: LogFn, error: LogFn): void {
  for (const result of results) {
    if (result.ok) {
      log(
        `${LOG_TAG} OK ${result.name} ${result.url} -> ${result.status} (${result.durationMs}ms)`
      );
    } else {
      error(
        `${LOG_TAG} FAIL ${result.name} ${result.url} -> ${result.status ?? "no-response"} (${result.durationMs}ms): ${result.error ?? result.body ?? "unknown error"}`
      );
    }
  }
}

export default async ({ req, res, log, error }: AppwriteContext) => {
  const startedAt = Date.now();

  try {
    const headers = req?.headers ?? {};
    const trigger = headers["x-appwrite-trigger"] ?? "unknown";
    const event = headers["x-appwrite-event"];
    log(
      `${LOG_TAG} start trigger=${trigger} method=${req?.method ?? "unknown"}${event ? ` event=${event}` : ""}`
    );

    const secret = process.env.CRON_SECRET;
    if (!secret) {
      error(`${LOG_TAG} CRON_SECRET is not configured — aborting`);
      return res.json(
        { ok: false, error: "CRON_SECRET is not configured" },
        500
      );
    }

    // Domain/HTTP executions are unauthenticated by Appwrite — require the secret
    // so a public URL can't force-run the jobs. Scheduled/event triggers are
    // platform-internal and trusted.
    if (
      trigger === "http" &&
      !authorizeHttpTrigger(headers, secret, log, error)
    ) {
      return res.json({ ok: false, error: "Unauthorized" }, 401);
    }

    const timeoutMs = resolveTimeoutMs();
    const { targets, skipped } = collectTargets();
    log(
      `${LOG_TAG} config secretSet=true timeoutMs=${timeoutMs} configured=[${targets.map((t) => t.name).join(", ")}] skipped=[${skipped.join(", ")}]`
    );

    if (targets.length === 0) {
      log(`${LOG_TAG} no cron endpoints configured; nothing to do`);
      return res.json({ ok: true, results: [] });
    }

    log(
      `${LOG_TAG} dispatching ${targets.length} ping(s): ${targets.map((t) => `${t.name} -> ${t.url}`).join(", ")}`
    );

    // Independent, idempotent endpoints — fire them concurrently so the run's
    // wall-clock is the slowest single request, not the sum of all of them.
    const results = await Promise.all(
      targets.map((target) => ping(target, secret, timeoutMs))
    );
    logResults(results, log, error);

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;
    const ok = failed === 0;
    const summary = JSON.stringify({
      durationMs: Date.now() - startedAt,
      failed,
      succeeded,
      total: results.length,
    });

    if (ok) {
      log(`${LOG_TAG} done ${summary}`);
    } else {
      error(`${LOG_TAG} completed with failures ${summary}`);
    }

    return res.json({ ok, results }, ok ? 200 : 502);
  } catch (err) {
    // Catch-all so an unexpected throw surfaces in the Errors tab (with a stack)
    // and the execution still terminates cleanly instead of an opaque crash.
    const message = err instanceof Error ? err.message : String(err);
    error(
      `${LOG_TAG} uncaught error after ${Date.now() - startedAt}ms: ${message}`
    );
    if (err instanceof Error && err.stack) {
      error(err.stack);
    }
    return res.json({ ok: false, error: message }, 500);
  }
};

/**
 * Scheduled-dispatch Appwrite Function.
 *
 * Runs on the cron `schedule` configured in appwrite.config.json (mirrored in
 * the Appwrite console) and pings the apps' secret-gated cron endpoints in
 * parallel. The real work lives in the Next.js apps (single source of truth);
 * this function is just the scheduler the Appwrite platform provides.
 *
 * This function also has a public domain (scheduler.biso.no). Appwrite treats
 * domain/HTTP executions as unauthenticated guests, so HTTP-triggered runs must
 * present the shared secret (via `x-cron-secret` or `Authorization: Bearer`)
 * before any endpoint is pinged. Scheduled (and event) executions are platform-
 * internal and trusted, so they run without it.
 *
 * The overall execution time limit is the function's `timeout` setting in
 * Appwrite (appwrite.config.json / console) — NOT controlled here. Keep it
 * comfortably above CRON_TIMEOUT_MS.
 *
 * Required env vars (set on the function in the Appwrite console / config):
 *   CRON_SECRET                 shared secret sent to (and checked by) the endpoints
 * Optional:
 *   ANNOUNCEMENTS_DISPATCH_URL  e.g. https://admin.biso.no/api/announcements/dispatch
 *   TICKSTER_SYNC_URL           e.g. https://api.biso.no/api/tickster/sync
 *   DEPARTURES_SYNC_URL         e.g. https://api.biso.no/api/departures/sync
 *   RESERVATIONS_CLEANUP_URL    e.g. https://biso.no/api/cron/cleanup-reservations
 *   CRON_TIMEOUT_MS             per-request timeout (default 30000)
 *
 * Note: tickster/sync and departures/sync compare the secret against
 * TICKSTER_SYNC_SECRET / ENTUR_SYNC_SECRET respectively (no CRON_SECRET
 * fallback), so set those equal to CRON_SECRET on apps/api to use them.
 */

import { timingSafeEqual } from "node:crypto";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_BODY_CHARS = 500;

/** Minimal shape of the Appwrite Functions runtime context we use. */
interface AppwriteContext {
  error: (message: unknown) => void;
  log: (message: unknown) => void;
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

interface PingResult {
  body?: string;
  error?: string;
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
  return auth?.startsWith("Bearer ") ? auth.slice(7) : null;
}

async function ping(
  url: string,
  secret: string,
  timeoutMs: number
): Promise<PingResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "x-cron-secret": secret },
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      url,
      status: response.status,
      ok: response.ok,
      body: text.slice(0, MAX_BODY_CHARS),
    };
  } catch (err) {
    return {
      url,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

export default async ({ req, res, log, error }: AppwriteContext) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    error("CRON_SECRET is not configured");
    return res.json({ ok: false, error: "CRON_SECRET is not configured" }, 500);
  }

  // Domain/HTTP executions are unauthenticated by Appwrite — require the secret
  // so a public URL can't force-run the jobs. Scheduled/event triggers are
  // platform-internal and trusted.
  const headers = req?.headers ?? {};
  if (headers["x-appwrite-trigger"] === "http") {
    const presented = headers["x-cron-secret"] ?? readBearer(headers);
    if (!safeSecretCompare(presented, secret)) {
      error("Unauthorized HTTP trigger: missing or invalid secret");
      return res.json({ ok: false, error: "Unauthorized" }, 401);
    }
  }

  const timeoutMs =
    Number.parseInt(process.env.CRON_TIMEOUT_MS ?? "", 10) ||
    DEFAULT_TIMEOUT_MS;

  const targets = [
    process.env.ANNOUNCEMENTS_DISPATCH_URL,
    process.env.TICKSTER_SYNC_URL,
    process.env.DEPARTURES_SYNC_URL,
    process.env.RESERVATIONS_CLEANUP_URL,
  ].filter((url): url is string => typeof url === "string" && url.length > 0);

  if (targets.length === 0) {
    log("No cron endpoints configured; nothing to do.");
    return res.json({ ok: true, results: [] });
  }

  // Independent, idempotent endpoints — fire them concurrently so the run's
  // wall-clock is the slowest single request, not the sum of all of them.
  const results = await Promise.all(
    targets.map((url) => ping(url, secret, timeoutMs))
  );

  for (const result of results) {
    if (result.ok) {
      log(`OK ${result.url} -> ${result.status}`);
    } else {
      error(`FAIL ${result.url}: ${result.error ?? result.status}`);
    }
  }

  const ok = results.every((r) => r.ok);
  return res.json({ ok, results }, ok ? 200 : 502);
};

"use strict";
/**
 * Scheduled-dispatch Appwrite Function.
 *
 * Runs on a cron schedule (see the `schedule` in the function config) and pings
 * the app's secret-gated cron endpoints. Keeping the work in the Next.js apps
 * means there's a single source of truth for dispatch/sync logic; this function
 * is just the scheduler the Appwrite platform provides.
 *
 * Required env vars (set on the function in the Appwrite console / config):
 *   CRON_SECRET                 shared secret expected by the endpoints
 *   ANNOUNCEMENTS_DISPATCH_URL  e.g. https://admin.biso.no/api/announcements/dispatch
 * Optional:
 *   TICKSTER_SYNC_URL           e.g. https://api.biso.no/api/tickster/sync
 *   DEPARTURES_SYNC_URL         e.g. https://api.biso.no/api/departures/sync
 *   CRON_TIMEOUT_MS             per-request timeout (default 60000)
 */

const DEFAULT_TIMEOUT_MS = 60_000;

async function ping(url, secret, timeoutMs) {
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
      body: text.slice(0, 500),
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

module.exports = async ({ res, log, error }) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    error("CRON_SECRET is not configured");
    return res.json({ ok: false, error: "CRON_SECRET is not configured" }, 500);
  }

  const timeoutMs =
    Number.parseInt(process.env.CRON_TIMEOUT_MS ?? "", 10) ||
    DEFAULT_TIMEOUT_MS;

  const targets = [
    process.env.ANNOUNCEMENTS_DISPATCH_URL,
    process.env.TICKSTER_SYNC_URL,
    process.env.DEPARTURES_SYNC_URL,
  ].filter((url) => typeof url === "string" && url.length > 0);

  if (targets.length === 0) {
    log("No cron endpoints configured; nothing to do.");
    return res.json({ ok: true, results: [] });
  }

  const results = [];
  for (const url of targets) {
    const result = await ping(url, secret, timeoutMs);
    results.push(result);
    if (result.ok) {
      log(`OK ${url} -> ${result.status}`);
    } else {
      error(`FAIL ${url}: ${result.error ?? result.status}`);
    }
  }

  const ok = results.every((r) => r.ok);
  return res.json({ ok, results }, ok ? 200 : 502);
};

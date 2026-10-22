import { type Models, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  APP_PLATFORMS,
  type AppVersionsConfig,
  type AppVersionsRow,
  EMPTY_APP_VERSIONS,
  policyFromRow,
} from "@repo/shared/utils/app-versions";

/**
 * Server-only reader for the app version rules `GET /api/config` reports.
 *
 * That endpoint is hit on every app launch, so this reads every platform's
 * row in one call and keeps the answer for a short module-level TTL, the same
 * way `feature-flags-server.ts` does. Each process caches independently.
 *
 * Fail-open: a missing table, a failed read or a read slower than
 * `READ_TIMEOUT_MS` all answer "no rules" and are NOT cached, so the next
 * call retries. The timeout keeps a slow Appwrite from holding up the whole
 * config, `features` included, past the app's own 5 s timeout.
 */

const TABLE = "app_versions";
const TTL_MS = 15_000;
const READ_TIMEOUT_MS = 2000;
const TIMED_OUT = Symbol("timed out");

let cache: { versions: AppVersionsConfig; expires: number } | null = null;

async function readRows(): Promise<AppVersionsConfig> {
  const { db } = await createAdminClient();
  const result = await db.listRows<AppVersionsRow & Models.Row>("app", TABLE, [
    Query.limit(10),
  ]);
  // Rows are keyed by platform ($id = platform), as the admin writes them.
  const byPlatform = new Map(result.rows.map((row) => [row.$id, row]));
  const versions: AppVersionsConfig = { ...EMPTY_APP_VERSIONS };
  for (const platform of APP_PLATFORMS) {
    versions[platform] = policyFromRow(byPlatform.get(platform) ?? null);
  }
  return versions;
}

/** A missing table is the expected state before the feature is set up. */
function isNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const { code, message } = error as { code?: unknown; message?: unknown };
  return (
    code === 404 ||
    (typeof message === "string" && message.toLowerCase().includes("not found"))
  );
}

/** Never throws. Platforms without a row answer nulls. */
export async function readAppVersions(): Promise<AppVersionsConfig> {
  const now = Date.now();
  if (cache && cache.expires > now) {
    return cache.versions;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), READ_TIMEOUT_MS);
  });

  try {
    const versions = await Promise.race([readRows(), timeout]);
    if (versions === TIMED_OUT) {
      console.error(
        `[app-versions] read took longer than ${READ_TIMEOUT_MS} ms; answering no rules`
      );
      return EMPTY_APP_VERSIONS;
    }
    cache = { versions, expires: now + TTL_MS };
    return versions;
  } catch (error) {
    if (!isNotFound(error)) {
      console.error("[app-versions] read failed; answering no rules:", error);
    }
    return EMPTY_APP_VERSIONS;
  } finally {
    clearTimeout(timer);
  }
}

/** Forgets the cached answer. Tests only. */
export function resetAppVersionsCacheForTests(): void {
  cache = null;
}

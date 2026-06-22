import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { FeatureFlags } from "@repo/api/types/appwrite";
import {
  type FeatureFlagKey,
  type FeatureFlagRow,
  mergeFlagStates,
} from "./feature-flags";

/**
 * Server-only runtime reader for feature flags. Reads the `feature_flags` table
 * with the service-key client and merges rows over the code catalog defaults.
 *
 * Caching: a short module-level TTL keeps repeated reads (every checkout,
 * /fs render, admin page nav) cheap while letting a toggle propagate within
 * ~TTL. Each app process caches independently.
 *
 * Fail-open: on any read error this returns catalog defaults and does NOT cache
 * the failure, so a DB blip never silently disables a kill switch and the next
 * call retries.
 *
 * Do not import this from client components — it pulls the server Appwrite
 * client. Client code should import the pure catalog from `./feature-flags`.
 */

const TABLE = "feature_flags";
const TTL_MS = 15_000;

let cache: {
  states: Record<FeatureFlagKey, boolean>;
  expires: number;
} | null = null;

export async function getFeatureFlagStates(): Promise<
  Record<FeatureFlagKey, boolean>
> {
  const now = Date.now();
  if (cache && cache.expires > now) {
    return cache.states;
  }

  try {
    const { db } = await createAdminClient();
    const result = await db.listRows<FeatureFlags>("app", TABLE, [
      Query.limit(200),
    ]);
    const rows: FeatureFlagRow[] = result.rows.map((row) => ({
      key: row.key,
      enabled: row.enabled,
    }));
    const states = mergeFlagStates(rows);
    cache = { states, expires: now + TTL_MS };
    return states;
  } catch (error) {
    console.error(
      "[feature-flags] read failed; falling back to catalog defaults:",
      error
    );
    return mergeFlagStates([]);
  }
}

/** Convenience single-flag check. */
export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const states = await getFeatureFlagStates();
  return states[key];
}

import type { Models } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  APP_PLATFORMS,
  type AppPlatform,
  type AppVersionPolicy,
  type AppVersionsConfig,
  type AppVersionsRow,
  EMPTY_APP_VERSIONS,
  policyFromRow,
} from "@repo/shared/utils/app-versions";

async function readPlatform(platform: AppPlatform): Promise<AppVersionPolicy> {
  try {
    const { db } = await createAdminClient();
    const row = await db.getRow<AppVersionsRow & Models.Row>(
      "app",
      "app_versions",
      platform
    );
    return policyFromRow(row);
  } catch {
    // Missing row or table: this platform simply has no rules. Silent on
    // purpose, the endpoint is hit on every app launch.
    return { minimum: null, recommended: null };
  }
}

/** Never throws. Each platform fails independently to "no rules". */
export async function readAppVersions(): Promise<AppVersionsConfig> {
  const policies = await Promise.all(APP_PLATFORMS.map(readPlatform));
  const result: AppVersionsConfig = { ...EMPTY_APP_VERSIONS };
  APP_PLATFORMS.forEach((platform, index) => {
    result[platform] = policies[index] as AppVersionPolicy;
  });
  return result;
}

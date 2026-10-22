"use server";

import type { Models } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  APP_PLATFORMS,
  type AppPlatform,
  type AppVersionError,
  type AppVersionPolicy,
  type AppVersionsRow,
  policyFromRow,
  validateAppVersionPolicy,
} from "@repo/shared/utils/app-versions";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import { logAuditEvent } from "../../_actions/audit-log";
import { fetchAppStoreVersion } from "./app-store-version";

const TABLE = "app_versions";

export interface AppVersionsView {
  appStoreVersion: string | null;
  policies: Record<AppPlatform, AppVersionPolicy>;
}

type SaveResult =
  | { data: AppVersionPolicy }
  | { error: AppVersionError | string };

async function requireAppVersionsAccess(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  if (!ctx.roles.includes("globaladmin")) {
    throw new Error("Forbidden: only global admins can manage app versions");
  }
  return ctx;
}

async function readRow(
  db: Awaited<ReturnType<typeof createSessionClient>>["db"],
  platform: AppPlatform
): Promise<AppVersionsRow | null> {
  try {
    return await db.getRow<AppVersionsRow & Models.Row>("app", TABLE, platform);
  } catch {
    return null;
  }
}

/** Current policy per platform plus the live App Store version. Global admin only. */
export async function getAppVersionsView(): Promise<AppVersionsView> {
  await requireAppVersionsAccess();
  const { db } = await createSessionClient();

  const [ios, android, appStoreVersion] = await Promise.all([
    readRow(db, "ios"),
    readRow(db, "android"),
    fetchAppStoreVersion(),
  ]);
  const rows: Record<AppPlatform, AppVersionsRow | null> = { ios, android };

  const policies = {} as Record<AppPlatform, AppVersionPolicy>;
  for (const platform of APP_PLATFORMS) {
    policies[platform] = policyFromRow(rows[platform]);
  }
  return { policies, appStoreVersion };
}

/** Validates and upserts the per-platform row ($id = platform). Audited. */
export async function saveAppVersionPolicy(
  platform: AppPlatform,
  input: { minimum: string; recommended: string }
): Promise<SaveResult> {
  try {
    const ctx = await requireAppVersionsAccess();
    if (!APP_PLATFORMS.includes(platform)) {
      return { error: `Unknown platform: ${platform}` };
    }

    const validated = validateAppVersionPolicy(input);
    if ("error" in validated) {
      return { error: validated.error };
    }
    const { policy } = validated;

    const { db } = await createSessionClient();
    await db.upsertRow("app", TABLE, platform, {
      platform,
      minimum_version: policy.minimum,
      recommended_version: policy.recommended,
    });

    await logAuditEvent(ctx, "app_versions.update", {
      resourceId: platform,
      resourceType: TABLE,
      payload: { ...policy },
    });

    revalidatePath("/settings/app-versions");
    return { data: policy };
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to save app version rules",
    };
  }
}

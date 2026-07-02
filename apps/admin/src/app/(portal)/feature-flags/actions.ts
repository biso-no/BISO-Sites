"use server";

import { ID, Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { FeatureFlags } from "@repo/api/types/appwrite";
import {
  FEATURE_FLAG_GROUPS,
  FEATURE_FLAGS,
  type FeatureFlagGroup,
  type FeatureFlagRow,
  getFlagDef,
  isKnownFlagKey,
  mergeFlagStates,
} from "@repo/shared/utils/feature-flags";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import { logAuditEvent } from "../_actions/audit-log";

const TABLE = "feature_flags";

export interface CatalogFlagItem {
  description: string;
  enabled: boolean;
  group: FeatureFlagGroup;
  key: string;
  title: string;
}

export interface CatalogFlagGroup {
  flags: CatalogFlagItem[];
  group: FeatureFlagGroup;
}

type ActionResult<T> = { data: T } | { error: string };

async function requireFeatureFlagAccess(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  if (!ctx.roles.includes("globaladmin")) {
    throw new Error("Forbidden: only global admins can manage feature flags");
  }
  return ctx;
}

async function readFlagStates() {
  const { db } = await createSessionClient();
  const result = await db.listRows<FeatureFlags>("app", TABLE, [
    Query.limit(200),
  ]);
  const rows: FeatureFlagRow[] = result.rows.map((row) => ({
    key: row.key,
    enabled: row.enabled,
  }));
  return mergeFlagStates(rows);
}

/**
 * The catalog of operational flags, grouped, with each flag's current on/off
 * state resolved from the DB (override) or the catalog default. Catalog-only:
 * non-catalog DB rows are ignored.
 */
export async function getCatalogFlagStates(): Promise<CatalogFlagGroup[]> {
  await requireFeatureFlagAccess();
  const states = await readFlagStates();

  return FEATURE_FLAG_GROUPS.map((group) => ({
    group,
    flags: FEATURE_FLAGS.filter((flag) => flag.group === group).map((flag) => ({
      key: flag.key,
      group: flag.group,
      title: flag.title,
      description: flag.description,
      enabled: states[flag.key],
    })),
  }));
}

/**
 * Toggle a catalog flag by key. Upserts the `feature_flags` row (update if it
 * exists, else create it from the catalog), audits, and revalidates.
 */
export async function setFeatureFlagByKey(
  key: string,
  enabled: boolean
): Promise<ActionResult<CatalogFlagItem>> {
  try {
    const ctx = await requireFeatureFlagAccess();
    const def = getFlagDef(key);
    if (!(isKnownFlagKey(key) && def)) {
      return { error: `Unknown feature flag: ${key}` };
    }

    const { db } = await createSessionClient();
    const existing = await db.listRows<FeatureFlags>("app", TABLE, [
      Query.equal("key", key),
      Query.limit(1),
    ]);

    const existingRow = existing.rows[0];
    const row = existingRow
      ? await db.updateRow<FeatureFlags>("app", TABLE, existingRow.$id, {
          enabled,
        })
      : await db.createRow<FeatureFlags>("app", TABLE, ID.unique(), {
          key,
          title: def.title,
          // The `description` column is capped at 100 chars and the catalog is
          // the display source, so the row keeps description null.
          description: null,
          enabled,
        });

    await logAuditEvent(ctx, "feature_flag.toggle", {
      resourceId: row.$id,
      resourceType: TABLE,
      payload: { key, enabled },
    });

    revalidatePath("/feature-flags");
    return {
      data: {
        key,
        group: def.group,
        title: def.title,
        description: def.description,
        enabled: row.enabled,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to update feature flag",
    };
  }
}

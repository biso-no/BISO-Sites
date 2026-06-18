"use server";

import { ID, Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { FeatureFlags } from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import { logAuditEvent } from "../_actions/audit-log";
import {
  type FeatureFlagInput,
  validateFeatureFlagInput,
} from "./feature-flags-model";

const TABLE = "feature_flags";

export interface FeatureFlagItem {
  description: string | null;
  enabled: boolean;
  id: string;
  key: string;
  title: string;
}

type ActionResult<T> = { data: T } | { error: string };

function toItem(row: FeatureFlags): FeatureFlagItem {
  return {
    id: row.$id,
    key: row.key,
    title: row.title,
    description: row.description ?? null,
    enabled: row.enabled,
  };
}

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

export async function listFeatureFlags(): Promise<FeatureFlagItem[]> {
  await requireFeatureFlagAccess();
  const { db } = await createSessionClient();
  const result = await db.listRows<FeatureFlags>("app", TABLE, [
    Query.orderAsc("title"),
    Query.limit(200),
  ]);
  return result.rows.map(toItem);
}

export async function setFeatureFlagEnabled(
  id: string,
  enabled: boolean
): Promise<ActionResult<FeatureFlagItem>> {
  try {
    const ctx = await requireFeatureFlagAccess();
    const { db } = await createSessionClient();
    const updated = await db.updateRow<FeatureFlags>("app", TABLE, id, {
      enabled,
    });

    await logAuditEvent(ctx, "feature_flag.toggle", {
      resourceId: id,
      resourceType: TABLE,
      payload: { key: updated.key, enabled },
    });

    revalidatePath("/feature-flags");
    return { data: toItem(updated) };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to update feature flag",
    };
  }
}

export async function createFeatureFlag(
  input: FeatureFlagInput
): Promise<ActionResult<FeatureFlagItem>> {
  try {
    const ctx = await requireFeatureFlagAccess();

    const validation = validateFeatureFlagInput(input);
    if (!validation.ok) {
      return { error: validation.error };
    }
    const flag = validation.value;

    const { db } = await createSessionClient();

    const existing = await db.listRows<FeatureFlags>("app", TABLE, [
      Query.equal("key", flag.key),
      Query.limit(1),
    ]);
    if (existing.rows.length > 0) {
      return { error: `A feature flag with key "${flag.key}" already exists` };
    }

    const created = await db.createRow<FeatureFlags>(
      "app",
      TABLE,
      ID.unique(),
      {
        key: flag.key,
        title: flag.title,
        description: flag.description,
        enabled: flag.enabled,
      }
    );

    await logAuditEvent(ctx, "feature_flag.create", {
      resourceId: created.$id,
      resourceType: TABLE,
      payload: { key: flag.key, enabled: flag.enabled },
    });

    revalidatePath("/feature-flags");
    return { data: toItem(created) };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to create feature flag",
    };
  }
}

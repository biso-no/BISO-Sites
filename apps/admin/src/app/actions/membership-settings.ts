"use server";

import { Query } from "@repo/api/client";
import { createAdminClient } from "@repo/api/server";
import type { Memberships } from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";

export interface MembershipSettingsItem {
  canPurchase: boolean;
  category: string | null;
  expiryDate: string;
  id: string;
  isExpired: boolean;
  name: string;
  productId: string;
  startDate: string;
  status: boolean;
}

/**
 * Fetch all memberships from Appwrite for the settings page
 */
export async function getMembershipSettings(): Promise<
  MembershipSettingsItem[]
> {
  const { db } = await createAdminClient();

  const response = await db.listRows<Memberships>("app", "memberships", [
    Query.orderDesc("expiryDate"),
    Query.limit(200),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return response.rows.map((m) => ({
    id: m.$id,
    name: m.name,
    productId: m.membership_id,
    category: m.category,
    startDate: m.startDate,
    expiryDate: m.expiryDate,
    status: m.status,
    canPurchase: m.canPurchase,
    isExpired: new Date(m.expiryDate) < today,
  }));
}

/**
 * Toggle a membership's active status
 */
export async function updateMembershipStatus(
  id: string,
  status: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { db } = await createAdminClient();
    await db.updateRow("app", "memberships", id, { status });
    revalidatePath("/membership/settings");
    return { success: true };
  } catch (error) {
    console.error("[Membership Settings] Failed to update status:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Toggle a membership's purchasable status
 */
export async function updateMembershipPurchasable(
  id: string,
  canPurchase: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { db } = await createAdminClient();
    await db.updateRow("app", "memberships", id, { canPurchase });
    revalidatePath("/membership/settings");
    return { success: true };
  } catch (error) {
    console.error("[Membership Settings] Failed to update canPurchase:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Bulk update multiple memberships
 */
async function bulkUpdateMemberships(
  updates: Array<{ id: string; status?: boolean; canPurchase?: boolean }>
): Promise<{ success: boolean; updated: number; errors: string[] }> {
  const { db } = await createAdminClient();
  let updated = 0;
  const errors: string[] = [];

  for (const update of updates) {
    try {
      const data: Record<string, boolean> = {};
      if (update.status !== undefined) {
        data.status = update.status;
      }
      if (update.canPurchase !== undefined) {
        data.canPurchase = update.canPurchase;
      }

      if (Object.keys(data).length > 0) {
        await db.updateRow("app", "memberships", update.id, data);
        updated += 1;
      }
    } catch (error) {
      errors.push(
        `Failed to update ${update.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  revalidatePath("/membership/settings");
  return { success: errors.length === 0, updated, errors };
}

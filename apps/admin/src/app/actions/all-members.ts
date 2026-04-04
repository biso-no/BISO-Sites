"use server";

import { ID, Query } from "@repo/api/client";
import { createAdminClient } from "@repo/api/server";
import type { Memberships, SyncedMembers } from "@repo/api/types/appwrite";
import {
  getCompaniesByIds,
  getCustomerCategoryTree,
} from "@repo/connectors/24sevenoffice";
import { revalidatePath } from "next/cache";
import {
  buildCategoryToMembershipMap,
  buildCompanyCategoriesMap,
  buildCompanyDocument,
  buildMembershipNameMap,
  getActiveCategoryIds,
  mapSyncedMemberToInfo,
} from "./_utils/all-members.utils";

import type {
  AllMembersResult,
  MemberInfo,
  SyncState,
} from "./all-members.types";

const JOB_ID = "member_sync";
const PARALLEL_BATCH_SIZE = 5;

interface BatchContext {
  categoryToMembership: Map<string, Memberships>;
  companyCategories: Map<number, number[]>;
  db: Awaited<ReturnType<typeof createAdminClient>>["db"];
  timestamp: string;
}

interface SyncStateRow {
  $id: string;
  job_id: unknown;
  message: unknown;
  progress_current: unknown;
  progress_total: unknown;
  status: unknown;
  updated_at: unknown;
}

/**
 * Process a single batch of companies and sync to Appwrite
 */
async function processBatch(
  batchIds: number[],
  ctx: BatchContext
): Promise<number> {
  const batchCompanies = await getCompaniesByIds(batchIds);
  let count = 0;

  for (const company of batchCompanies) {
    const doc = buildCompanyDocument(
      company,
      ctx.companyCategories,
      ctx.categoryToMembership,
      ctx.timestamp
    );

    if (!doc) {
      continue;
    }

    try {
      await (
        ctx.db as unknown as {
          upsertRow: (
            db: string,
            table: string,
            id: string,
            data: unknown
          ) => Promise<unknown>;
        }
      ).upsertRow("app", "members", doc.id, doc.data);
      count += 1;
    } catch (err) {
      console.error(`[Sync] upsert error for ${doc.id}:`, err);
    }
  }

  return count;
}

/**
 * Report sync error to state document
 */
async function reportSyncError(errorMessage: string): Promise<void> {
  try {
    const { db } = await createAdminClient();
    const existingStates = await db.listRows<SyncStateRow>(
      "app",
      "sync_states",
      [Query.equal("job_id", JOB_ID), Query.limit(1)]
    );
    if (existingStates.rows.length > 0) {
      await db.updateRow("app", "sync_states", existingStates.rows[0].$id, {
        status: "error",
        message: `Error: ${errorMessage}`,
        updated_at: new Date().toISOString(),
      });
    }
  } catch {
    // ignore
  }
}

/**
 * Get the current status of the sync job.
 */
export async function getSyncStatus(): Promise<SyncState | null> {
  try {
    const { db } = await createAdminClient();
    const response = await db.listRows<SyncStateRow>("app", "sync_states", [
      Query.equal("job_id", JOB_ID),
      Query.limit(1),
    ]);

    if (response.rows.length === 0) {
      return null;
    }

    const row = response.rows[0];
    return {
      job_id: row.job_id as string,
      status: row.status as string,
      progress_current: row.progress_current as number,
      progress_total: row.progress_total as number,
      message: row.message as string,
      updated_at: row.updated_at as string,
    };
  } catch (error) {
    console.error("Failed to get sync status:", error);
    return null;
  }
}

/**
 * Request the sync job to stop.
 */
export async function stopSync(): Promise<void> {
  const { db } = await createAdminClient();
  const status = await getSyncStatus();

  if (status && status.status === "running") {
    const response = await db.listRows<SyncStateRow>("app", "sync_states", [
      Query.equal("job_id", JOB_ID),
      Query.limit(1),
    ]);

    if (response.rows.length > 0) {
      await db.updateRow("app", "sync_states", response.rows[0].$id, {
        status: "stopping",
        message: "Stopping requested by user...",
        updated_at: new Date().toISOString(),
      });
    }
  }
}

/**
 * Sync all active members from 24SevenOffice to Appwrite.
 * With persistent state for background processing.
 */
export async function syncAllMembers(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  try {
    console.log("[Sync] Starting member sync...");
    const { db } = await createAdminClient();

    // 1. Initialize Sync State
    let stateDocId = "";
    const existingStates = await db.listRows<SyncStateRow>(
      "app",
      "sync_states",
      [Query.equal("job_id", JOB_ID), Query.limit(1)]
    );

    const now = new Date().toISOString();
    const initialState = {
      job_id: JOB_ID,
      status: "running",
      progress_current: 0,
      progress_total: 0,
      message: "Initializing...",
      updated_at: now,
    };

    if (existingStates.rows.length > 0) {
      stateDocId = existingStates.rows[0].$id;
      await db.updateRow("app", "sync_states", stateDocId, initialState);
    } else {
      const newDoc = await db.createRow(
        "app",
        "sync_states",
        ID.unique(),
        initialState
      );
      stateDocId = newDoc.$id;
    }

    // Helper to update state
    const updateState = async (updates: Partial<SyncState>) => {
      await db.updateRow("app", "sync_states", stateDocId, {
        ...updates,
        updated_at: new Date().toISOString(),
      });
    };

    // Helper to check for stop signal
    const shouldStop = async () => {
      const current = await db.getRow<SyncStateRow>(
        "app",
        "sync_states",
        stateDocId
      );
      return current.status === "stopping";
    };

    // 2. Get active memberships from Appwrite
    await updateState({ message: "Fetching active membership definitions..." });
    const membershipsResponse = await db.listRows<Memberships>(
      "app",
      "memberships",
      [Query.equal("status", true), Query.limit(100)]
    );
    const activeMemberships = membershipsResponse.rows;

    if (activeMemberships.length === 0) {
      await updateState({
        status: "success",
        message: "No active memberships configured.",
        progress_total: 0,
      });
      return { success: true, count: 0 };
    }

    // Mapping: Category ID -> Membership Data
    const categoryToMembership =
      buildCategoryToMembershipMap(activeMemberships);
    const activeCategoryIds = getActiveCategoryIds(categoryToMembership);

    // 3. Get all customer-category mappings from 24SO
    await updateState({
      message: "Fetching customer categories from 24SevenOffice...",
    });
    const allMappings = await getCustomerCategoryTree();

    if (await shouldStop()) {
      await updateState({ status: "idle", message: "Stopped by user." });
      return { success: false, count: 0, error: "Stopped by user" };
    }

    // 4. Filter active customers
    await updateState({ message: "Filtering active customers..." });
    const companyCategories = buildCompanyCategoriesMap(
      allMappings,
      activeCategoryIds
    );

    const activeCompanyIds = [...companyCategories.keys()];
    const totalCount = activeCompanyIds.length;
    console.log(`[Sync] Found ${totalCount} companies with active memberships`);

    await updateState({
      progress_total: totalCount,
      message: `Found ${totalCount} active members. Starting details fetch...`,
    });

    if (totalCount === 0) {
      await updateState({
        status: "success",
        message: "No active members found.",
        progress_current: 0,
      });
      return { success: true, count: 0 };
    }

    // 5. Batch fetch company details & Sync
    let syncedCount = 0;

    for (let i = 0; i < activeCompanyIds.length; i += PARALLEL_BATCH_SIZE) {
      if (await shouldStop()) {
        await updateState({ status: "idle", message: "Stopped by user." });
        return { success: false, count: syncedCount, error: "Stopped by user" };
      }

      const batchIds = activeCompanyIds.slice(i, i + PARALLEL_BATCH_SIZE);
      const currentBatchStart = i + 1;

      await updateState({
        message: `Syncing members ${currentBatchStart} - ${Math.min(i + PARALLEL_BATCH_SIZE, totalCount)} of ${totalCount}...`,
      });

      const batchCount = await processBatch(batchIds, {
        db,
        companyCategories,
        categoryToMembership,
        timestamp: now,
      });
      syncedCount += batchCount;

      await updateState({ progress_current: syncedCount });
    }

    await updateState({
      status: "success",
      message: `Completed. Synced ${syncedCount} members.`,
      progress_current: totalCount,
    });

    console.log(`[Sync] Successfully synced ${syncedCount} members`);
    revalidatePath("/membership/all");
    return { success: true, count: syncedCount };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Sync] Sync failed:", error);
    await reportSyncError(errorMessage);
    return { success: false, count: 0, error: errorMessage };
  }
}

/**
 * Get synced members from Appwrite.
 * Used for the UI display.
 */
export async function getSyncedMembers(
  page = 1,
  limit = 20,
  search?: string
): Promise<AllMembersResult> {
  const { db } = await createAdminClient();

  const queries = [
    Query.limit(limit),
    Query.offset((page - 1) * limit),
    Query.orderAsc("name"),
  ];

  if (search?.trim()) {
    queries.push(Query.search("name", search));
  }

  const membershipsResponse = await db.listRows<Memberships>(
    "app",
    "memberships",
    [Query.equal("status", true)]
  );
  const activeMemberships = membershipsResponse.rows;
  const membershipMap = buildMembershipNameMap(activeMemberships);

  const { rows, total } = await db.listRows<SyncedMembers>(
    "app",
    "members",
    queries
  );

  const members: MemberInfo[] = rows.map((row) =>
    mapSyncedMemberToInfo(row, membershipMap)
  );

  const lastSynced = rows.length > 0 ? rows[0].last_synced : null;

  return {
    members,
    totalCount: total,
    activeMembershipCount: activeMemberships.length,
    lastSynced,
  };
}

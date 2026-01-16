"use server";

import { createAdminClient } from "@repo/api/server";
import { Query, ID } from "@repo/api/client";
import type { Memberships, SyncedMembers } from "@repo/api/types/appwrite";
import {
    getCustomerCategoryTree,
    getCompaniesByIds,
    type Company,
} from "@repo/connectors/24sevenoffice";
import { revalidatePath } from "next/cache";

// ============= Types =============

export interface MemberInfo {
    companyId: number;
    name: string;
    externalId: string | null;
    memberships: {
        id: string;
        name: string;
        categoryId: string;
        expiryDate: string;
    }[];
    lastSynced?: string;
}

export interface AllMembersResult {
    members: MemberInfo[];
    totalCount: number;
    activeMembershipCount: number;
    lastSynced: string | null;
}

export interface SyncState {
    job_id: string;
    status: 'idle' | 'running' | 'stopping' | 'error' | 'success';
    progress_current: number;
    progress_total: number;
    message?: string;
    updated_at: string;
}

const JOB_ID = "member_sync";

// ============= Server Actions =============

/**
 * Get the current status of the sync job.
 */
export async function getSyncStatus(): Promise<SyncState | null> {
    try {
        const { db } = await createAdminClient();
        const response = await db.listRows<any>("app", "sync_states", [
            Query.equal("job_id", JOB_ID),
            Query.limit(1)
        ]);

        if (response.rows.length === 0) return null;

        const row = response.rows[0];
        return {
            job_id: row.job_id,
            status: row.status,
            progress_current: row.progress_current,
            progress_total: row.progress_total,
            message: row.message,
            updated_at: row.updated_at
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
        // Find row ID to update. Since job_id isn't the doc ID, we query it.
        // Actually, let's just query to get the ID.
        const response = await db.listRows<any>("app", "sync_states", [
            Query.equal("job_id", JOB_ID),
            Query.limit(1)
        ]);

        if (response.rows.length > 0) {
            await db.updateRow("app", "sync_states", response.rows[0].$id, {
                status: "stopping",
                message: "Stopping requested by user...",
                updated_at: new Date().toISOString()
            });
        }
    }
}

/**
 * Sync all active members from 24SevenOffice to Appwrite.
 * With persistent state for background processing.
 */
export async function syncAllMembers(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
        console.log("[Sync] Starting member sync...");
        const { db } = await createAdminClient();

        // 1. Initialize Sync State
        let stateDocId = "";
        const existingStates = await db.listRows<any>("app", "sync_states", [
            Query.equal("job_id", JOB_ID),
            Query.limit(1)
        ]);

        const now = new Date().toISOString();
        const initialState = {
            job_id: JOB_ID,
            status: "running",
            progress_current: 0,
            progress_total: 0,
            message: "Initializing...",
            updated_at: now
        };

        if (existingStates.rows.length > 0) {
            stateDocId = existingStates.rows[0].$id;
            await db.updateRow("app", "sync_states", stateDocId, initialState);
        } else {
            const newDoc = await db.createRow("app", "sync_states", ID.unique(), initialState);
            stateDocId = newDoc.$id;
        }

        // Helper to update state
        const updateState = async (updates: Partial<SyncState>) => {
            await db.updateRow("app", "sync_states", stateDocId, {
                ...updates,
                updated_at: new Date().toISOString()
            });
        };

        // Helper to check for stop signal
        const shouldStop = async () => {
            const current = await db.getRow<any>("app", "sync_states", stateDocId);
            return current.status === "stopping";
        };

        // 2. Get active memberships from Appwrite
        await updateState({ message: "Fetching active membership definitions..." });
        const membershipsResponse = await db.listRows<Memberships>("app", "memberships", [
            Query.equal("status", true),
            Query.limit(100),
        ]);
        const activeMemberships = membershipsResponse.rows;

        if (activeMemberships.length === 0) {
            await updateState({ status: "success", message: "No active memberships configured.", progress_total: 0 });
            return { success: true, count: 0 };
        }

        // Mapping: Category ID -> Membership Data
        const categoryToMembership = new Map<string, Memberships>();
        for (const m of activeMemberships) {
            if (m.category) {
                categoryToMembership.set(m.category, m);
            }
        }
        const activeCategoryIds = new Set([...categoryToMembership.keys()].map(id => parseInt(id, 10)));

        // 3. Get all customer-category mappings from 24SO
        await updateState({ message: "Fetching customer categories from 24SevenOffice..." });
        const allMappings = await getCustomerCategoryTree();

        if (await shouldStop()) {
            await updateState({ status: "idle", message: "Stopped by user." });
            return { success: false, count: 0, error: "Stopped by user" };
        }

        // 4. Filter active customers
        await updateState({ message: "Filtering active customers..." });
        const companyCategories = new Map<number, number[]>();
        for (const mapping of allMappings) {
            if (activeCategoryIds.has(mapping.categoryId)) {
                const existing = companyCategories.get(mapping.companyId) || [];
                existing.push(mapping.categoryId);
                companyCategories.set(mapping.companyId, existing);
            }
        }

        const activeCompanyIds = [...companyCategories.keys()];
        const totalCount = activeCompanyIds.length;
        console.log(`[Sync] Found ${totalCount} companies with active memberships`);

        await updateState({
            progress_total: totalCount,
            message: `Found ${totalCount} active members. Starting details fetch...`
        });

        if (totalCount === 0) {
            await updateState({ status: "success", message: "No active members found.", progress_current: 0 });
            return { success: true, count: 0 };
        }

        // 5. Batch fetch company details & Sync
        // We'll perform batches here manually to track progress and checking cancellation
        const PARALLEL_BATCH_SIZE = 5;
        const companies = await getCompaniesByIds([]); // Helper reuse to get session if needed, but we'll use loop below.
        // Actually, we need to call company fetch in loop here to update progress properly.
        // Re-implementing the loop logic from getCompaniesByIds but inside here to track progress.

        let syncedCount = 0;
        const companyMap = new Map<number, Company>();

        // We fetch companies in batches and UPSERT immediately to Appwrite
        // This keeps memory usage low and provides granular progress

        for (let i = 0; i < activeCompanyIds.length; i += PARALLEL_BATCH_SIZE) {
            // Check for stop signal
            if (await shouldStop()) {
                await updateState({ status: "idle", message: "Stopped by user." });
                return { success: false, count: syncedCount, error: "Stopped by user" };
            }

            const batchIds = activeCompanyIds.slice(i, i + PARALLEL_BATCH_SIZE);
            const currentBatchStart = i + 1;

            await updateState({
                message: `Syncing members ${currentBatchStart} - ${Math.min(i + PARALLEL_BATCH_SIZE, totalCount)} of ${totalCount}...`
            });

            // Fetch batch details using our existing optimized function (which we can assume handles a small list fine)
            // But wait, the existing function `getCompaniesByIds` handles batching internally. 
            // If we call it with a small batch, it works fine.
            const batchCompanies = await getCompaniesByIds(batchIds);

            // Process batch
            for (const company of batchCompanies) {
                if (!company.Id) continue;
                const categoryIds = companyCategories.get(company.Id) || [];

                // Resolve active category names
                const activeCategoryNames = categoryIds
                    .map(catId => categoryToMembership.get(catId.toString())?.name)
                    .filter((n): n is string => !!n);

                const docData = {
                    company_id: company.Id,
                    name: company.Name || "Unknown",
                    external_id: company.ExternalId || "",
                    active_categories: activeCategoryNames,
                    last_synced: now,
                };

                try {
                    await (db as any).upsertRow("app", "members", company.Id.toString(), docData);
                    syncedCount++;
                } catch (err) {
                    console.error(`[Sync] upsert error for ${company.Id}:`, err);
                }
            }

            // Update progress
            await updateState({ progress_current: syncedCount });

            // Revalidate occasionally so UI updates list if needed (optional)
        }

        await updateState({
            status: "success",
            message: `Completed. Synced ${syncedCount} members.`,
            progress_current: totalCount
        });

        // Reset to idle after a short delay or leave as success? 
        // Best to leave as success so user sees it completed, then reset on next run.

        console.log(`[Sync] Successfully synced ${syncedCount} members`);
        revalidatePath("/membership/all");
        return { success: true, count: syncedCount };

    } catch (error: any) {
        console.error("[Sync] Sync failed:", error);

        // Try to report error to state
        try {
            const { db } = await createAdminClient();
            const existingStates = await db.listRows<any>("app", "sync_states", [
                Query.equal("job_id", JOB_ID),
                Query.limit(1)
            ]);
            if (existingStates.rows.length > 0) {
                await db.updateRow("app", "sync_states", existingStates.rows[0].$id, {
                    status: "error",
                    message: `Error: ${error.message}`,
                    updated_at: new Date().toISOString()
                });
            }
        } catch (e) {
            // ignore
        }

        return { success: false, count: 0, error: error.message };
    }
}

/**
 * Get synced members from Appwrite.
 * Used for the UI display.
 */
export async function getSyncedMembers(
    page: number = 1,
    limit: number = 20,
    search?: string
): Promise<AllMembersResult> {
    const { db } = await createAdminClient();

    const queries = [
        Query.limit(limit),
        Query.offset((page - 1) * limit),
        Query.orderAsc("name"),
    ];

    if (search && search.trim()) {
        queries.push(Query.search("name", search));
    }

    // Get active memberships definition to map names back to expiry dates if needed,
    // though the SyncedMembers only stores category names. 
    // To show expiry, we still need the membership definitions.
    const membershipsResponse = await db.listRows<Memberships>("app", "memberships", [
        Query.equal("status", true),
    ]);
    const activeMemberships = membershipsResponse.rows;
    const membershipMap = new Map<string, Memberships>();
    for (const m of activeMemberships) {
        membershipMap.set(m.name, m);
    }

    const { rows, total } = await db.listRows<SyncedMembers>("app", "members", queries);

    const members: MemberInfo[] = rows.map((row) => {
        // Map stored category names back to full membership details for display
        const memberMemberships = row.active_categories.map((name) => {
            const m = membershipMap.get(name);
            if (!m) return null;
            return {
                id: m.$id,
                name: m.name,
                categoryId: m.category!,
                expiryDate: m.expiryDate,
            };
        }).filter((m): m is NonNullable<typeof m> => !!m);

        return {
            companyId: row.company_id,
            name: row.name,
            externalId: row.external_id,
            memberships: memberMemberships,
            lastSynced: row.last_synced,
        };
    });

    // Get the timestamp of the most recently synced item (proxy for global last sync)
    // or we could store a global sync state object.
    const lastSynced = rows.length > 0 ? rows[0].last_synced : null;

    return {
        members,
        totalCount: total,
        activeMembershipCount: activeMemberships.length,
        lastSynced,
    };
}

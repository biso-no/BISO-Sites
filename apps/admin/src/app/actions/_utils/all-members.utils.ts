/**
 * Pure utility functions for member sync operations.
 * NO 'use server' directive - these are imported by server actions.
 */

import type { Memberships } from "@repo/api/types/appwrite";
import type { Company } from "@repo/connectors/24sevenoffice";

export interface CompanyDocument {
  data: Record<string, unknown>;
  id: string;
}

/**
 * Build document data for a company to sync to Appwrite
 */
export function buildCompanyDocument(
  company: Company,
  companyCategories: Map<number, number[]>,
  categoryToMembership: Map<string, Memberships>,
  timestamp: string
): CompanyDocument | null {
  if (!company.Id) {
    return null;
  }

  const categoryIds = companyCategories.get(company.Id) || [];
  const activeCategoryNames = categoryIds
    .map((catId) => categoryToMembership.get(catId.toString())?.name)
    .filter((n): n is string => !!n);

  return {
    id: company.Id.toString(),
    data: {
      company_id: company.Id,
      name: company.Name || "Unknown",
      external_id: company.ExternalId || "",
      active_categories: activeCategoryNames,
      last_synced: timestamp,
    },
  };
}

/**
 * Build category-to-membership mapping from active memberships
 */
export function buildCategoryToMembershipMap(
  activeMemberships: Memberships[]
): Map<string, Memberships> {
  const map = new Map<string, Memberships>();
  for (const m of activeMemberships) {
    if (m.category) {
      map.set(m.category, m);
    }
  }
  return map;
}

/**
 * Extract active category IDs from the membership map
 */
export function getActiveCategoryIds(
  categoryToMembership: Map<string, Memberships>
): Set<number> {
  return new Set(
    [...categoryToMembership.keys()].map((id) => Number.parseInt(id, 10))
  );
}

/**
 * Filter mappings to get company-to-categories map for active memberships only
 */
export function buildCompanyCategoriesMap(
  allMappings: { companyId: number; categoryId: number }[],
  activeCategoryIds: Set<number>
): Map<number, number[]> {
  const companyCategories = new Map<number, number[]>();
  for (const mapping of allMappings) {
    if (activeCategoryIds.has(mapping.categoryId)) {
      const existing = companyCategories.get(mapping.companyId) || [];
      existing.push(mapping.categoryId);
      companyCategories.set(mapping.companyId, existing);
    }
  }
  return companyCategories;
}

/**
 * Create initial sync state object
 */
export function createInitialSyncState(jobId: string, timestamp: string) {
  return {
    job_id: jobId,
    status: "running",
    progress_current: 0,
    progress_total: 0,
    message: "Initializing...",
    updated_at: timestamp,
  };
}

/**
 * Build membership name-to-data map for display purposes
 */
export function buildMembershipNameMap(
  memberships: Memberships[]
): Map<string, Memberships> {
  const map = new Map<string, Memberships>();
  for (const m of memberships) {
    map.set(m.name, m);
  }
  return map;
}

/**
 * Map a synced member row to display format
 */
export function mapSyncedMemberToInfo(
  row: {
    company_id: number;
    name: string;
    external_id: string | null;
    active_categories: string[];
    last_synced: string;
  },
  membershipMap: Map<string, Memberships>
): {
  companyId: number;
  name: string;
  externalId: string | null;
  memberships: {
    id: string;
    name: string;
    categoryId: string;
    expiryDate: string;
  }[];
  lastSynced: string;
} {
  const memberMemberships = row.active_categories
    .map((name) => {
      const m = membershipMap.get(name);
      if (!m) {
        return null;
      }
      return {
        id: m.$id,
        name: m.name,
        categoryId: m.category!,
        expiryDate: m.expiryDate,
      };
    })
    .filter((m): m is NonNullable<typeof m> => !!m);

  return {
    companyId: row.company_id,
    name: row.name,
    externalId: row.external_id,
    memberships: memberMemberships,
    lastSynced: row.last_synced,
  };
}

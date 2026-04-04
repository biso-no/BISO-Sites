/**
 * Types for member synchronization operations
 * Extracted from server action to comply with architectural rules
 */

export interface MemberInfo {
  companyId: number;
  externalId: string | null;
  lastSynced?: string;
  memberships: {
    id: string;
    name: string;
    categoryId: string;
    expiryDate: string;
  }[];
  name: string;
}

export interface AllMembersResult {
  activeMembershipCount: number;
  lastSynced: string | null;
  members: MemberInfo[];
  totalCount: number;
}

export interface SyncState {
  job_id: string;
  message?: string;
  progress_current: number;
  progress_total: number;
  status: "idle" | "running" | "stopping" | "error" | "success";
  updated_at: string;
}

export type CategoryToMembershipMap = Map<
  string,
  {
    $id: string;
    name: string;
    category: string | null;
    expiryDate: string;
  }
>;

export type CompanyCategoriesMap = Map<number, number[]>;

export type SyncUpdateFn = (updates: Partial<SyncState>) => Promise<void>;
export type ShouldStopFn = () => Promise<boolean>;

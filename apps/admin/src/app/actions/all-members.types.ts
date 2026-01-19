/**
 * Types for member synchronization operations
 * Extracted from server action to comply with architectural rules
 */

export type MemberInfo = {
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
};

export type AllMembersResult = {
  members: MemberInfo[];
  totalCount: number;
  activeMembershipCount: number;
  lastSynced: string | null;
};

export type SyncState = {
  job_id: string;
  status: "idle" | "running" | "stopping" | "error" | "success";
  progress_current: number;
  progress_total: number;
  message?: string;
  updated_at: string;
};

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

import { z } from "zod";

// ============================================================================
// User Management Schemas
// ============================================================================

/**
 * Schema for creating a new user in M365 and syncing to Appwrite
 */
export const createUserSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(64),
  lastName: z.string().min(1, "Last name is required").max(64),
  email: z.string().email().optional(),
  campusId: z.string().min(1, "Campus is required"),
  departmentId: z.string().min(1, "Department is required"),
  managerId: z.string().optional(),
  additionalGroupIds: z.array(z.string()).default([]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * Schema for bulk user creation
 */
export const bulkCreateUserRowSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(64),
  lastName: z.string().min(1, "Last name is required").max(64),
  email: z.string().email().optional(),
  campusId: z.string().min(1, "Campus is required"),
  departmentId: z.string().min(1, "Department is required"),
  managerId: z.string().optional(),
  additionalGroupIds: z.array(z.string()).default([]),
});

export const bulkCreateUsersSchema = z.object({
  users: z.array(bulkCreateUserRowSchema).min(1).max(100),
});

export type BulkCreateUsersInput = z.infer<typeof bulkCreateUsersSchema>;

/**
 * Schema for updating a user
 */
export const updateUserSchema = z.object({
  departmentId: z.string().optional(),
  campusId: z.string().optional(),
  managerId: z.string().nullable().optional(),
  additionalGroupIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ============================================================================
// Account Turnover Schemas
// ============================================================================

/**
 * Schema for a single account turnover operation
 */
export const accountTurnoverSchema = z.object({
  roleMailboxUpn: z.string().email("Valid role mailbox UPN required"),
  incomingUserUpn: z.string().email("Valid incoming user UPN required"),
  ensureShared: z.boolean().default(true),
  dryRun: z.boolean().default(false),
});

export type AccountTurnoverInput = z.infer<typeof accountTurnoverSchema>;

/**
 * Schema for bulk account turnover
 */
export const bulkAccountTurnoverSchema = z.object({
  operations: z.array(accountTurnoverSchema).min(1).max(50),
  dryRunAll: z.boolean().default(false),
});

export type BulkAccountTurnoverInput = z.infer<
  typeof bulkAccountTurnoverSchema
>;

// ============================================================================
// Response Types
// ============================================================================

export interface CreateUserResult {
  error?: string;
  groupsAssigned?: string[];
  success: boolean;
  upn?: string;
  userId?: string;
}

export interface BulkCreateUserResult {
  index: number;
  input: CreateUserInput;
  result: CreateUserResult;
}

export interface BulkCreateUsersResponse {
  results: BulkCreateUserResult[];
  totalFailed: number;
  totalRequested: number;
  totalSucceeded: number;
}

export interface AccountTurnoverResult {
  dryRun: boolean;
  error?: string;
  incomingUserUpn: string;
  roleMailboxUpn: string;
  success: boolean;
  webhookResponse?: unknown;
}

export interface BulkAccountTurnoverResponse {
  results: AccountTurnoverResult[];
  totalFailed: number;
  totalRequested: number;
  totalSucceeded: number;
}

// ============================================================================
// Admin Scope Types
// ============================================================================

/**
 * Represents the authorization scope for an admin user
 */
export interface AdminScope {
  /** True if admin can manage any campus (National + OperationsUnit) */
  canManageAnyCampus: boolean;
  /** Whether admin is a campus admin */
  isCampusAdmin: boolean;
  /** Whether admin is a global admin */
  isGlobalAdmin: boolean;
  /** Campus names the admin can manage */
  managedCampusNames: string[];
  /** Department names the admin can manage (empty if campus-level or global) */
  managedDepartmentNames: string[];
  /** User ID of the admin */
  userId: string;
}

// ============================================================================
// M365 Group Types
// ============================================================================

export interface M365Group {
  description?: string;
  displayName: string;
  id: string;
  isSecurityGroup: boolean;
}

export interface M365User {
  department?: string;
  displayName: string;
  id: string;
  mail?: string;
  managerId?: string;
  officeLocation?: string;
  userPrincipalName: string;
}

// ============================================================================
// IT Admin / Microsoft 365 User Management Schemas
// ============================================================================

export const m365UserSearchSchema = z.object({
  query: z.string().trim().max(128).default(""),
  limit: z.number().int().min(1).max(50).default(25),
});

export type M365UserSearchInput = z.infer<typeof m365UserSearchSchema>;

export const m365UserProfileUpdateSchema = z.object({
  userId: z.string().min(1),
  accountStatusConfirmation: z.string().trim().optional(),
  accountEnabled: z.boolean().optional(),
  businessPhones: z.array(z.string().trim().max(64)).max(3).optional(),
  department: z.string().trim().max(128).nullable().optional(),
  displayName: z.string().trim().min(1).max(256).optional(),
  givenName: z.string().trim().max(64).nullable().optional(),
  jobTitle: z.string().trim().max(128).nullable().optional(),
  mailNickname: z.string().trim().min(1).max(64).optional(),
  mobilePhone: z.string().trim().max(64).nullable().optional(),
  officeLocation: z.string().trim().max(128).nullable().optional(),
  surname: z.string().trim().max(64).nullable().optional(),
  userPrincipalName: z.string().trim().email().optional(),
});

export type M365UserProfileUpdateInput = z.infer<
  typeof m365UserProfileUpdateSchema
>;

export const m365CreateUserSchema = z.object({
  accountEnabled: z.boolean().default(true),
  campusId: z.string().min(1, "Campus is required"),
  departmentId: z.string().min(1, "Department is required"),
  forceChangePasswordNextSignIn: z.boolean().default(true),
  givenName: z.string().trim().min(1, "Given name is required").max(64),
  jobTitle: z.string().trim().max(128).optional(),
  mailNickname: z.string().trim().max(64).optional(),
  managerId: z.string().trim().optional(),
  surname: z.string().trim().min(1, "Surname is required").max(64),
  userPrincipalName: z.string().trim().email().optional(),
});

export type M365CreateUserInput = z.infer<typeof m365CreateUserSchema>;

export const m365AliasConflictSchema = z.object({
  alias: z.string().trim().email(),
  targetUserId: z.string().min(1).optional(),
});

export type M365AliasConflictInput = z.infer<typeof m365AliasConflictSchema>;

export const m365UserIdSchema = z.object({
  userId: z.string().min(1),
});

export const m365ManagerUpdateSchema = z.object({
  userId: z.string().min(1),
  managerId: z.string().min(1),
});

export const m365GroupMembershipSchema = z.object({
  userId: z.string().min(1),
  groupId: z.string().min(1),
});

export const m365GroupSearchSchema = z.object({
  query: z.string().trim().max(128).default(""),
  limit: z.number().int().min(1).max(50).default(25),
});

export const m365LicenseManageSchema = z.object({
  userId: z.string().min(1),
  skuId: z.string().min(1),
});

export const m365UpnCheckSchema = z.object({
  upn: z.string().trim().email(),
  userId: z.string().min(1),
});

export const m365AliasAddSchema = z.object({
  alias: z.string().trim().email(),
  userId: z.string().min(1),
});

export const m365AliasRemoveSchema = z.object({
  alias: z.string().trim().min(1),
  userId: z.string().min(1),
});

export const m365AliasTransferSchema = z.object({
  alias: z.string().trim().email(),
  fromUserId: z.string().min(1),
  replacementAlias: z.string().trim().email().optional(),
  toUserId: z.string().min(1),
});

export type M365ManagerUpdateInput = z.infer<typeof m365ManagerUpdateSchema>;
export type M365GroupMembershipInput = z.infer<
  typeof m365GroupMembershipSchema
>;
export type M365GroupSearchInput = z.infer<typeof m365GroupSearchSchema>;
export type M365LicenseManageInput = z.infer<typeof m365LicenseManageSchema>;
export type M365UserIdInput = z.infer<typeof m365UserIdSchema>;
export type M365UpnCheckInput = z.infer<typeof m365UpnCheckSchema>;
export type M365AliasAddInput = z.infer<typeof m365AliasAddSchema>;
export type M365AliasRemoveInput = z.infer<typeof m365AliasRemoveSchema>;
export type M365AliasTransferInput = z.infer<typeof m365AliasTransferSchema>;

export type M365Permission =
  | "it.users.view"
  | "it.users.create"
  | "it.users.editProfile"
  | "it.users.disable"
  | "it.users.manageAliases"
  | "it.users.transferAlias"
  | "it.users.manageManagers"
  | "it.users.manageGroups"
  | "it.users.manageLicenses"
  | "it.users.resetMfa"
  | "it.users.revokeSessions"
  | "it.users.viewSecurity"
  | "it.users.resetPassword";

export type M365AliasOwnerType =
  | "user"
  | "group"
  | "mailbox"
  | "sharedMailbox"
  | "distributionList"
  | "unknown";

export interface M365AliasConflictResult {
  alias: string;
  available: boolean;
  owner?: {
    displayName?: string | null;
    id: string;
    mail?: string | null;
    type: M365AliasOwnerType;
    userPrincipalName?: string | null;
  };
  requiresExchangeOnline?: boolean;
}

export interface M365UserListItem {
  accountEnabled: boolean | null;
  createdDateTime: string | null;
  department: string | null;
  displayName: string;
  id: string;
  jobTitle: string | null;
  lastSignInDateTime: string | null;
  mail: string | null;
  officeLocation: string | null;
  userPrincipalName: string;
}

export interface M365UserDetail extends M365UserListItem {
  assignedLicenses: Array<{ skuId: string }>;
  businessPhones: string[];
  employeeId: string | null;
  givenName: string | null;
  mailNickname: string | null;
  manager: M365UserListItem | null;
  mobilePhone: string | null;
  proxyAddresses: string[];
  surname: string | null;
}

export interface M365UserGroup {
  description: string | null;
  displayName: string;
  groupTypes: string[];
  id: string;
  isTeamsRelated: boolean;
  mail: string | null;
  mailEnabled: boolean;
  membershipType: "direct" | "inherited" | "unknown";
  securityEnabled: boolean;
}

export interface M365UserLicenseDetail {
  servicePlans: Array<{
    provisioningStatus: string | null;
    servicePlanId: string;
    servicePlanName: string | null;
  }>;
  skuId: string;
  skuPartNumber: string | null;
}

export interface M365SubscribedSku {
  consumedUnits: number;
  prepaidUnits: { enabled: number; suspended: number; warning: number };
  skuId: string;
  skuPartNumber: string;
}

export interface M365AuthenticationMethodsSummary {
  error?: string;
  methods: Array<{
    createdDateTime?: string | null;
    displayName?: string | null;
    id: string;
    odataType: string;
    type: string;
  }>;
}

// ============================================================================
// Campus & Department Selection Types
// ============================================================================

export interface CampusOption {
  id: string;
  name: string;
  officeLocation: string; // Maps to M365 Office location
}

export interface DepartmentOption {
  campusId: string;
  id: string;
  name: string;
  securityGroupName: string; // e.g., "SG-App-Department-OSL-SIVOK"
}

// ============================================================================
// Audit Log Types
// ============================================================================

export type UserManagementAuditAction =
  | "create-user"
  | "bulk-create"
  | "update-user"
  | "sync-groups"
  | "turnover"
  | "bulk-turnover";

export interface UserManagementAuditLog {
  action: UserManagementAuditAction;
  actorEmail?: string;
  actorId: string;
  error?: string;
  groupChanges?: {
    added: string[];
    removed: string[];
  };
  requestedCampusId?: string;
  requestedDepartmentId?: string;
  requestedManagerId?: string;
  success: boolean;
  targetUserIds: string[];
  timestamp: string;
  webhookResponse?: unknown;
}

// ============================================================================
// Department Remediation Types
// ============================================================================

export type RemediationTier =
  | "safe-exact"
  | "safe-truncation"
  | "review-suggested"
  | "review-no-match"
  | "closed";

// One distinct M365 department value and the fix proposed for everyone on it.
export interface RemediationGroup {
  affectedUsers: M365UserListItem[];
  score: number | null; // similarity 0-1 when applicable
  suggestedCampusName: string | null; // campus the suggestion belongs to
  suggestedDepartment: string | null; // canonical name to write
  tier: RemediationTier;
  value: string; // the raw M365 department string ("" = blank department)
}

export interface DepartmentRemediationPlan {
  closed: RemediationGroup[];
  compliantCount: number;
  review: RemediationGroup[];
  safe: RemediationGroup[];
  totalScanned: number;
}

// A single accepted fix decision sent to applyDepartmentFixes.
export interface DepartmentFixDecision {
  campusName: string; // office location to write
  department: string; // exact canonical name to write
  userIds: string[];
}

export interface DepartmentFixSummary {
  failed: Array<{ userId: string; error: string }>;
  succeeded: number;
}

// 24SO data-health report.
export type DepartmentDataIssue =
  | "trailingWhitespace"
  | "duplicateName"
  | "activeClosed";

export interface DepartmentDataHealthEntry {
  campusName: string;
  id: string;
  issues: DepartmentDataIssue[];
  name: string;
}
